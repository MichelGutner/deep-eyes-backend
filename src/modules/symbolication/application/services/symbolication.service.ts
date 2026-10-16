import { Inject, Injectable } from '@nestjs/common';
import { Logger } from '@/logger/application';
import type { ErrorInfo, ILog } from '@/modules/logs/domain/log.interface';
import { readMachOSlices } from '../../domain/macho';
import {
  formatLocation,
  parseAppleFrame,
  parseNdkFrame,
} from '../../domain/native-frames';
import {
  R8Mapping,
  retraceClassName,
  retraceStack,
} from '../../domain/r8-retrace';
import {
  detectSymbolizerTools,
  SymbolizedLocation,
  symbolizeWithAtos,
  symbolizeWithLlvm,
} from '../../infrastructure/native-symbolizer';
import { SymbolStoreService } from './symbol-store.service';

interface AppleImage {
  name: string;
  base: number;
  size: number;
  uuid: string;
}

type Method = 'r8-mapping' | 'dsym' | 'native-lib';

/** LogEntity stores the stack as trimmed lines, but ILog allows a raw string too. */
function stackLines(err: ErrorInfo | undefined): string[] {
  if (!err?.stack) return [];
  return Array.isArray(err.stack)
    ? [...err.stack]
    : err.stack
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
}

function asErrorInfo(value: unknown): ErrorInfo | undefined {
  return value && typeof value === 'object' ? (value as ErrorInfo) : undefined;
}

/**
 * Turns the raw native frames the SDK ships (obfuscated Java classes, iOS return addresses,
 * Android .so offsets) into function + file:line using the symbol files uploaded for the
 * application. Best-effort by design: anything missing (no upload for this release, no
 * llvm-symbolizer/atos on the host) leaves the frames exactly as the device sent them, and
 * no failure here ever rejects the log.
 */
@Injectable()
export class SymbolicationService {
  constructor(
    private readonly store: SymbolStoreService,
    @Inject('Logger')
    private readonly logger: Logger,
  ) {}

  async symbolicate(log: ILog, applicationId: string): Promise<void> {
    const error = log.error;
    const stack = stackLines(error);
    if (!error || !stack.length) return;
    const metadata = (log.metadata ?? {}) as Record<string, unknown>;
    const platform = (metadata.platform as string | undefined) ?? log.platform;

    const used = new Set<Method>();
    const rawStack = [...stack];
    try {
      if (platform === 'android') {
        await this.symbolicateAndroid(log, error, stack, applicationId, used);
      } else if (platform === 'ios') {
        await this.symbolicateIos(stack, applicationId, metadata, used);
      }
    } catch (err) {
      // Keep whatever was resolved before the failure — `stack` is consistent after each step.
      this.logger.warn(
        `Symbolication failed for log ${log.id}: ${(err as Error).message}`,
      );
    }

    if (used.size) {
      log.metadata = {
        ...metadata,
        symbolicated: true,
        symbolicatedWith: [...used],
        rawStack,
      };
      // The Java path may have expanded inline frames and rewritten causes in place; native
      // paths edit `stack` — either way the top-level stack is `stack` from here on.
      error.stack = stack;
    }
  }

  // ── Android ─────────────────────────────────────────────────────────────

  private async symbolicateAndroid(
    log: ILog,
    error: ErrorInfo,
    stack: string[],
    applicationId: string,
    used: Set<Method>,
  ): Promise<void> {
    if (!log.release) return;

    const mapping = await this.store.getAndroidMapping(
      applicationId,
      log.release,
    );
    if (mapping) {
      const top = retraceStack(mapping, stack);
      if (top.retracedFrames) {
        stack.splice(0, stack.length, ...top.lines);
        used.add('r8-mapping');
      }
      for (
        let err: ErrorInfo | undefined = error;
        err;
        err = asErrorInfo(err.cause)
      ) {
        if (err.name) {
          const name = retraceClassName(mapping, err.name);
          if (name !== err.name) used.add('r8-mapping');
          err.name = name;
        }
        if (err !== error && this.retraceCause(mapping, err))
          used.add('r8-mapping');
      }
    }

    if (await this.symbolicateNdkFrames(stack, log.release, applicationId))
      used.add('native-lib');
  }

  private retraceCause(mapping: R8Mapping, err: ErrorInfo): boolean {
    const result = retraceStack(mapping, stackLines(err));
    if (!result.retracedFrames) return false;
    err.stack = result.lines;
    return true;
  }

  private async symbolicateNdkFrames(
    stack: string[],
    release: string,
    applicationId: string,
  ): Promise<boolean> {
    const frames = stack
      .map((line, i) => ({ i, frame: parseNdkFrame(line) }))
      .filter((f) => f.frame);
    if (!frames.length) return false;

    const { llvmSymbolizer } = await detectSymbolizerTools();
    if (!llvmSymbolizer) return false;

    const byLib = new Map<string, typeof frames>();
    for (const f of frames) {
      const key = `${f.frame!.libName}|${f.frame!.abi ?? ''}`;
      byLib.set(key, [...(byLib.get(key) ?? []), f]);
    }

    let changed = false;
    for (const group of byLib.values()) {
      const { libName, abi } = group[0].frame!;
      const lib = await this.store.getNativeLib(
        applicationId,
        release,
        libName,
        abi,
      );
      if (!lib) continue;
      // pc of every frame but the crashing one is a return address — step back into the call.
      const offsets = group.map((f) =>
        f.frame!.index > 0 && f.frame!.relOffset > 0n
          ? f.frame!.relOffset - 1n
          : f.frame!.relOffset,
      );
      const resolved = await symbolizeWithLlvm(
        llvmSymbolizer,
        this.store.absolutePath(lib),
        offsets,
      );
      group.forEach((f, k) => {
        const loc = resolved[k];
        if (!loc?.function && !loc?.file) return;
        stack[f.i] =
          `${stack[f.i]} — ${formatLocation(loc.function, loc.file, loc.line)}`;
        changed = true;
      });
    }
    return changed;
  }

  // ── iOS ─────────────────────────────────────────────────────────────────

  private async symbolicateIos(
    stack: string[],
    applicationId: string,
    metadata: Record<string, unknown>,
    used: Set<Method>,
  ): Promise<void> {
    const images = (
      Array.isArray(metadata.images) ? metadata.images : []
    ) as AppleImage[];
    const frameAddresses = (
      Array.isArray(metadata.frameAddresses) ? metadata.frameAddresses : []
    ) as number[];
    if (!images.length || !frameAddresses.length) return;

    const tools = await detectSymbolizerTools();
    if (!tools.llvmSymbolizer && !tools.atos) return;

    const resolved = new Map<bigint, SymbolizedLocation>();
    for (const image of images) {
      if (typeof image?.uuid !== 'string' || typeof image.base !== 'number')
        continue;
      const base = BigInt(image.base);
      const end = base + BigInt(image.size ?? 0);
      const inImage = frameAddresses
        .map((addr, index) => ({ index, addr: BigInt(addr) }))
        .filter(({ addr }) => addr >= base && addr < end);
      if (!inImage.length) continue;

      const dsym = await this.store.getDsym(applicationId, image.uuid);
      if (!dsym) continue;
      const objectPath = this.store.absolutePath(dsym);
      const arch = dsym.arch ?? 'arm64';
      // Return addresses point after the call; look up the call itself.
      const lookups = inImage.map(({ index, addr }) =>
        index > 0 ? addr - 1n : addr,
      );

      let locations: SymbolizedLocation[];
      if (tools.llvmSymbolizer) {
        const slice = (await readMachOSlices(objectPath)).find(
          (s) => s.uuid === dsym.debug_id,
        );
        const vmBase = slice?.textVmAddr ?? 0n;
        locations = await symbolizeWithLlvm(
          tools.llvmSymbolizer,
          objectPath,
          lookups.map((addr) => addr - base + vmBase),
          arch,
        );
      } else {
        locations = await symbolizeWithAtos(
          tools.atos!,
          objectPath,
          base,
          lookups,
          arch,
        );
      }
      inImage.forEach(({ addr }, k) => {
        if (locations[k]?.function || locations[k]?.file)
          resolved.set(addr, locations[k]);
      });
    }
    if (!resolved.size) return;

    let changed = false;
    for (let i = 0; i < stack.length; i++) {
      const frame = parseAppleFrame(stack[i]);
      const loc = frame && resolved.get(frame.address);
      if (!frame || !loc) continue;
      stack[i] =
        `${frame.prefix} ${formatLocation(loc.function, loc.file, loc.line)}`;
      changed = true;
    }
    if (changed) used.add('dsym');
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { SymbolFile, SymbolFileType } from '@prisma/client';
import {
  copyFile,
  link,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  unlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { PRISMA_SERVICE, PrismaService } from '@/modules/prisma';
import { MachOSlice, normalizeUuid, readMachOSlices } from '../../domain/macho';
import { parseR8Mapping, R8Mapping } from '../../domain/r8-retrace';
import { extractZip } from '../../infrastructure/native-symbolizer';

/** Where uploaded symbol files live (env SYMBOLS_DIR, default ./data/symbols); the DB stores paths relative to it. */
export function symbolsDir(): string {
  return resolve(
    process.env.SYMBOLS_DIR ?? join(process.cwd(), 'data', 'symbols'),
  );
}

const MAPPING_CACHE_SIZE = 3;
const NEGATIVE_TTL_MS = 60_000;

/** Path segments come from user input (release, lib name) — never let them escape SYMBOLS_DIR. */
function safeSegment(value: string): string {
  const cleaned = value
    .replace(/[^\w.+-]/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/^\./, '_');
  return cleaned.slice(0, 200) || '_';
}

async function placeFile(
  from: string,
  to: string,
  move: boolean,
): Promise<void> {
  await mkdir(dirname(to), { recursive: true });
  await rm(to, { force: true });
  if (move) {
    try {
      await rename(from, to);
      return;
    } catch {
      // EXDEV (tmp on another volume) — fall through to copy.
    }
  } else {
    try {
      await link(from, to); // fat dSYMs: one file, several UUIDs — share it at no disk cost
      return;
    } catch {
      // Cross-device or unsupported — copy instead.
    }
  }
  await copyFile(from, to);
  if (move) await unlink(from).catch(() => undefined);
}

export interface StoredDsym {
  uuid: string;
  arch: string;
  name: string;
}

@Injectable()
export class SymbolStoreService {
  /** Parsed mappings are big; keep the few most recently used releases. */
  private readonly mappingCache = new Map<string, R8Mapping>();
  /** "No symbols for this key" answers, so every JS error on a release without a mapping isn't a DB round-trip. */
  private readonly misses = new Map<string, number>();

  constructor(
    @Inject(PRISMA_SERVICE)
    private readonly prisma: PrismaService,
  ) {}

  absolutePath(file: Pick<SymbolFile, 'path'>): string {
    return join(symbolsDir(), file.path);
  }

  private async upsert(
    applicationId: string,
    key: string,
    data: Omit<
      SymbolFile,
      'id' | 'application_id' | 'key' | 'created_at' | 'updated_at'
    >,
  ): Promise<SymbolFile> {
    this.misses.clear();
    return this.prisma.symbolFile.upsert({
      where: { application_id_key: { application_id: applicationId, key } },
      create: { application_id: applicationId, key, ...data },
      update: data,
    });
  }

  async saveAndroidMapping(
    applicationId: string,
    release: string,
    tempPath: string,
  ): Promise<SymbolFile> {
    const rel = join(
      safeSegment(applicationId),
      'android-mapping',
      `${safeSegment(release)}.txt`,
    );
    await placeFile(tempPath, join(symbolsDir(), rel), true);
    const { size } = await stat(join(symbolsDir(), rel));
    return this.upsert(applicationId, `mapping:${release}`, {
      type: SymbolFileType.ANDROID_MAPPING,
      release,
      debug_id: null,
      name: 'mapping.txt',
      arch: null,
      path: rel,
      size,
    });
  }

  async saveNativeLib(
    applicationId: string,
    release: string,
    name: string,
    arch: string | undefined,
    tempPath: string,
  ): Promise<SymbolFile> {
    const rel = join(
      safeSegment(applicationId),
      'native-lib',
      safeSegment(release),
      safeSegment(arch ?? 'any'),
      safeSegment(name),
    );
    await placeFile(tempPath, join(symbolsDir(), rel), true);
    const { size } = await stat(join(symbolsDir(), rel));
    return this.upsert(applicationId, `so:${release}:${arch ?? ''}:${name}`, {
      type: SymbolFileType.ANDROID_NATIVE_LIB,
      release,
      debug_id: null,
      name,
      arch: arch ?? null,
      path: rel,
      size,
    });
  }

  /**
   * Accepts a zipped `.dSYM` bundle (or several, e.g. a zipped dSYMs folder from an
   * .xcarchive) or a bare DWARF Mach-O, and indexes every slice by its image UUID.
   */
  async saveDsym(
    applicationId: string,
    tempPath: string,
  ): Promise<StoredDsym[]> {
    const isZip = await startsWithZipMagic(tempPath);

    const work = await mkdtemp(join(tmpdir(), 'deep-eyes-dsym-'));
    try {
      let candidates: string[];
      if (isZip) {
        await extractZip(tempPath, work);
        candidates = await findDwarfFiles(work);
      } else {
        candidates = [tempPath];
      }

      const stored: StoredDsym[] = [];
      for (const file of candidates) {
        let slices: MachOSlice[];
        try {
          slices = await readMachOSlices(file);
        } catch {
          continue;
        }
        const name = file === tempPath ? 'DWARF' : basename(file);
        for (const slice of slices) {
          const rel = join(safeSegment(applicationId), 'dsym', slice.uuid);
          await placeFile(file, join(symbolsDir(), rel), false);
          const { size } = await stat(join(symbolsDir(), rel));
          await this.upsert(applicationId, `dsym:${slice.uuid}`, {
            type: SymbolFileType.IOS_DSYM,
            release: null,
            debug_id: slice.uuid,
            name,
            arch: slice.arch,
            path: rel,
            size,
          });
          stored.push({ uuid: slice.uuid, arch: slice.arch, name });
        }
      }
      return stored;
    } finally {
      await rm(work, { recursive: true, force: true });
      await rm(tempPath, { force: true });
    }
  }

  list(applicationId: string): Promise<SymbolFile[]> {
    return this.prisma.symbolFile.findMany({
      where: { application_id: applicationId },
      orderBy: { created_at: 'desc' },
    });
  }

  async remove(applicationId: string, id: string): Promise<boolean> {
    const file = await this.prisma.symbolFile.findFirst({
      where: { id, application_id: applicationId },
    });
    if (!file) return false;
    await this.prisma.symbolFile.delete({ where: { id } });
    await rm(this.absolutePath(file), { force: true });
    this.mappingCache.clear();
    return true;
  }

  private async findCached(
    applicationId: string,
    key: string,
  ): Promise<SymbolFile | null> {
    const cacheKey = `${applicationId}|${key}`;
    const missAt = this.misses.get(cacheKey);
    if (missAt && Date.now() - missAt < NEGATIVE_TTL_MS) return null;
    const file = await this.prisma.symbolFile.findUnique({
      where: { application_id_key: { application_id: applicationId, key } },
    });
    if (!file) this.misses.set(cacheKey, Date.now());
    return file;
  }

  async getAndroidMapping(
    applicationId: string,
    release: string,
  ): Promise<R8Mapping | undefined> {
    const file = await this.findCached(applicationId, `mapping:${release}`);
    if (!file) return undefined;

    const cacheKey = `${file.id}@${file.updated_at.getTime()}`;
    const cached = this.mappingCache.get(cacheKey);
    if (cached) {
      this.mappingCache.delete(cacheKey);
      this.mappingCache.set(cacheKey, cached); // bump to most recent
      return cached;
    }

    const mapping = parseR8Mapping(
      await readFile(this.absolutePath(file), 'utf8'),
    );
    this.mappingCache.set(cacheKey, mapping);
    while (this.mappingCache.size > MAPPING_CACHE_SIZE) {
      this.mappingCache.delete(this.mappingCache.keys().next().value!);
    }
    return mapping;
  }

  getDsym(applicationId: string, uuid: string): Promise<SymbolFile | null> {
    return this.findCached(applicationId, `dsym:${normalizeUuid(uuid)}`);
  }

  /** Exact arch first, then an arch-less upload of the same lib. */
  async getNativeLib(
    applicationId: string,
    release: string,
    name: string,
    arch: string | undefined,
  ): Promise<SymbolFile | null> {
    if (arch) {
      const exact = await this.findCached(
        applicationId,
        `so:${release}:${arch}:${name}`,
      );
      if (exact) return exact;
    }
    return this.findCached(applicationId, `so:${release}::${name}`);
  }
}

async function startsWithZipMagic(path: string): Promise<boolean> {
  const fh = await open(path, 'r');
  try {
    const head = Buffer.alloc(2);
    await fh.read(head, 0, 2, 0);
    return head[0] === 0x50 && head[1] === 0x4b; // "PK"
  } finally {
    await fh.close();
  }
}

/** DWARF files inside `X.dSYM/Contents/Resources/DWARF/`, anywhere in the extracted tree. */
async function findDwarfFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name))
    .filter(
      (p) =>
        p.includes(`${sep}Contents${sep}Resources${sep}DWARF${sep}`) &&
        !basename(p).startsWith('.'),
    );
}

import { execFile } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface SymbolizedLocation {
  function?: string;
  file?: string;
  line?: number;
}

export interface SymbolizerTools {
  llvmSymbolizer?: string;
  atos?: string;
}

const EXEC_OPTIONS = { timeout: 15_000, maxBuffer: 16 * 1024 * 1024 };

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findOnPath(
  names: string[],
  extraDirs: string[] = [],
): Promise<string | undefined> {
  const dirs = [
    ...(process.env.PATH ?? '').split(delimiter).filter(Boolean),
    ...extraDirs,
  ];
  for (const name of names) {
    for (const dir of dirs) {
      const candidate = join(dir, name);
      if (await isExecutable(candidate)) return candidate;
    }
  }
  return undefined;
}

let detected: Promise<SymbolizerTools> | undefined;

/**
 * Looks for llvm-symbolizer (any platform; LLVM_SYMBOLIZER_PATH overrides) and atos (macOS
 * with Xcode tools). Detected once per process; neither is required — without them native
 * frames are simply left as the SDK sent them.
 */
export function detectSymbolizerTools(): Promise<SymbolizerTools> {
  detected ??= (async () => {
    const override = process.env.LLVM_SYMBOLIZER_PATH;
    const llvmSymbolizer =
      override && (await isExecutable(override))
        ? override
        : await findOnPath(
            [
              'llvm-symbolizer',
              ...Array.from(
                { length: 12 },
                (_, i) => `llvm-symbolizer-${21 - i}`,
              ),
            ],
            ['/opt/homebrew/opt/llvm/bin', '/usr/local/opt/llvm/bin'],
          );
    const atos =
      process.platform === 'darwin' ? await findOnPath(['atos']) : undefined;
    return { llvmSymbolizer, atos };
  })();
  return detected;
}

/** Test hook. */
export function resetSymbolizerToolsCache(): void {
  detected = undefined;
}

const UNKNOWN = new Set(['', '??', '<invalid>']);

function clean(value: unknown): string | undefined {
  return typeof value === 'string' && !UNKNOWN.has(value) ? value : undefined;
}

interface LlvmJsonEntry {
  Address?: string;
  Symbol?: Array<{ FunctionName?: string; FileName?: string; Line?: number }>;
}

export function parseLlvmSymbolizerJson(output: string): SymbolizedLocation[] {
  let entries: LlvmJsonEntry[];
  const trimmed = output.trim();
  try {
    // Addresses on the command line → one JSON array; via stdin → one object per line.
    const parsed = JSON.parse(trimmed) as LlvmJsonEntry | LlvmJsonEntry[];
    entries = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    entries = trimmed
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as LlvmJsonEntry);
  }
  return entries.map((entry) => {
    // First Symbol is the innermost inlined frame — the actual line that was executing.
    const sym = entry.Symbol?.[0];
    return {
      function: clean(sym?.FunctionName),
      file: clean(sym?.FileName),
      line: sym?.Line ? sym.Line : undefined,
    };
  });
}

/**
 * Symbolizes file addresses (already relative to the object's own vmaddr space) with
 * llvm-symbolizer. `arch` picks the slice of a fat Mach-O; irrelevant for ELF.
 */
export async function symbolizeWithLlvm(
  tool: string,
  objectPath: string,
  addresses: bigint[],
  arch?: string,
): Promise<SymbolizedLocation[]> {
  if (!addresses.length) return [];
  const args = [
    `--obj=${objectPath}`,
    '--output-style=JSON',
    '--demangle',
    '--functions=linkage',
  ];
  if (arch) args.push(`--default-arch=${arch}`);
  args.push(...addresses.map((a) => `0x${a.toString(16)}`));
  const { stdout } = await execFileAsync(tool, args, EXEC_OPTIONS);
  return parseLlvmSymbolizerJson(stdout);
}

// `-[Foo bar:] (in MyApp) (Foo.m:42)` / `closure #1 in Foo.run() (in MyApp) (Foo.swift:12)`
const ATOS_WITH_FILE = /^(.*) \(in [^)]+\) \(([^()]+):(\d+)\)$/;
// `-[Foo bar:] (in MyApp) + 40` — symbol known, no line info in the dSYM for it
const ATOS_NO_FILE = /^(.*) \(in [^)]+\)(?: \+ \d+)?$/;

export function parseAtosOutput(output: string): SymbolizedLocation[] {
  return output
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => {
      const withFile = ATOS_WITH_FILE.exec(line.trim());
      if (withFile)
        return {
          function: withFile[1],
          file: withFile[2],
          line: Number(withFile[3]),
        };
      const noFile = ATOS_NO_FILE.exec(line.trim());
      if (noFile) return { function: noFile[1] };
      return {}; // atos echoes the bare address when it can't resolve it
    });
}

/** Symbolizes runtime addresses with atos, given the image's runtime load address. */
export async function symbolizeWithAtos(
  tool: string,
  objectPath: string,
  loadAddress: bigint,
  addresses: bigint[],
  arch: string,
): Promise<SymbolizedLocation[]> {
  if (!addresses.length) return [];
  const args = [
    '-o',
    objectPath,
    '-arch',
    arch,
    '-l',
    `0x${loadAddress.toString(16)}`,
    ...addresses.map((a) => `0x${a.toString(16)}`),
  ];
  const { stdout } = await execFileAsync(tool, args, EXEC_OPTIONS);
  return parseAtosOutput(stdout);
}

export async function findUnzip(): Promise<
  { tool: string; args: (zip: string, dest: string) => string[] } | undefined
> {
  const unzip = await findOnPath(['unzip']);
  if (unzip)
    return { tool: unzip, args: (zip, dest) => ['-qq', '-o', zip, '-d', dest] };
  if (process.platform === 'darwin') {
    const ditto = await findOnPath(['ditto']);
    if (ditto)
      return { tool: ditto, args: (zip, dest) => ['-x', '-k', zip, dest] };
  }
  return undefined;
}

export async function extractZip(zipPath: string, dest: string): Promise<void> {
  const unzip = await findUnzip();
  if (!unzip)
    throw new Error(
      'No unzip tool on this host (install `unzip`), or upload the bare DWARF file instead',
    );
  await execFileAsync(unzip.tool, unzip.args(zipPath, dest), {
    ...EXEC_OPTIONS,
    timeout: 120_000,
  });
}

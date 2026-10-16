import { open } from 'node:fs/promises';

/**
 * Just enough Mach-O parsing to index a dSYM's DWARF file: for each architecture slice,
 * the image UUID (LC_UUID, what the SDK reports per loaded image) and the __TEXT vmaddr
 * (needed to turn "offset inside the image" into the file address llvm-symbolizer wants).
 * Pure Node, so indexing works on Linux hosts without Xcode tools.
 */

export interface MachOSlice {
  /** Uppercase hex, no dashes — the same shape the SDK sends in metadata.images[].uuid. */
  uuid: string;
  arch: string;
  textVmAddr: bigint;
}

const MH_MAGIC = 0xfeedface;
const MH_MAGIC_64 = 0xfeedfacf;
const FAT_MAGIC = 0xcafebabe;
const FAT_MAGIC_64 = 0xcafebabf;

const LC_SEGMENT = 0x1;
const LC_SEGMENT_64 = 0x19;
const LC_UUID = 0x1b;

const CPU_ARCH_ABI64 = 0x01000000;
const CPU_TYPE_X86 = 7;
const CPU_TYPE_ARM = 12;
const CPU_SUBTYPE_MASK = 0x00ffffff;

export function archName(cputype: number, cpusubtype: number): string {
  const sub = cpusubtype & CPU_SUBTYPE_MASK;
  switch (cputype) {
    case CPU_TYPE_ARM | CPU_ARCH_ABI64:
      return sub === 2 ? 'arm64e' : 'arm64';
    case CPU_TYPE_X86 | CPU_ARCH_ABI64:
      return 'x86_64';
    case CPU_TYPE_ARM:
      return sub === 11 ? 'armv7s' : sub === 12 ? 'armv7k' : 'armv7';
    case CPU_TYPE_X86:
      return 'i386';
    default:
      return `cpu${cputype}`;
  }
}

type Reader = (offset: number, length: number) => Promise<Buffer>;

async function parseThin(
  read: Reader,
  base: number,
): Promise<MachOSlice | undefined> {
  const header = await read(base, 32);
  if (header.length < 28) return undefined;
  const magic = header.readUInt32LE(0);
  if (magic !== MH_MAGIC && magic !== MH_MAGIC_64) return undefined; // big-endian thin images don't exist on Apple platforms anymore
  const is64 = magic === MH_MAGIC_64;
  const cputype = header.readInt32LE(4);
  const cpusubtype = header.readInt32LE(8);
  const ncmds = header.readUInt32LE(16);
  const sizeofcmds = header.readUInt32LE(20);
  const headerSize = is64 ? 32 : 28;

  const cmds = await read(base + headerSize, sizeofcmds);
  let uuid: string | undefined;
  let textVmAddr = 0n;
  let off = 0;
  for (let i = 0; i < ncmds && off + 8 <= cmds.length; i++) {
    const cmd = cmds.readUInt32LE(off);
    const cmdsize = cmds.readUInt32LE(off + 4);
    if (cmdsize < 8) break;
    if (cmd === LC_UUID && off + 24 <= cmds.length) {
      uuid = cmds
        .subarray(off + 8, off + 24)
        .toString('hex')
        .toUpperCase();
    } else if (cmd === LC_SEGMENT_64 || cmd === LC_SEGMENT) {
      const segname = cmds
        .subarray(off + 8, off + 24)
        .toString('latin1')
        .replace(/\0.*$/s, '');
      if (segname === '__TEXT') {
        textVmAddr =
          cmd === LC_SEGMENT_64
            ? cmds.readBigUInt64LE(off + 24)
            : BigInt(cmds.readUInt32LE(off + 24));
      }
    }
    off += cmdsize;
  }

  return uuid
    ? { uuid, arch: archName(cputype, cpusubtype), textVmAddr }
    : undefined;
}

export async function readMachOSlicesFromReader(
  read: Reader,
): Promise<MachOSlice[]> {
  const head = await read(0, 8);
  if (head.length < 8) return [];
  const beMagic = head.readUInt32BE(0);

  if (beMagic === FAT_MAGIC || beMagic === FAT_MAGIC_64) {
    const nfat = head.readUInt32BE(4);
    // Java class files share 0xCAFEBABE; there this word is the class version (45+).
    if (nfat === 0 || nfat > 20) return [];
    const entrySize = beMagic === FAT_MAGIC_64 ? 32 : 20;
    const table = await read(8, nfat * entrySize);
    if (table.length < nfat * entrySize) return [];
    const slices: MachOSlice[] = [];
    for (let i = 0; i < nfat; i++) {
      const e = i * entrySize;
      const offset =
        beMagic === FAT_MAGIC_64
          ? Number(table.readBigUInt64BE(e + 8))
          : table.readUInt32BE(e + 8);
      const slice = await parseThin(read, offset);
      if (slice) slices.push(slice);
    }
    return slices;
  }

  const slice = await parseThin(read, 0);
  return slice ? [slice] : [];
}

export function readMachOSlicesFromBuffer(buf: Buffer): Promise<MachOSlice[]> {
  return readMachOSlicesFromReader(async (offset, length) =>
    buf.subarray(offset, offset + length),
  );
}

/** Reads only the headers — dSYM DWARF files can be hundreds of MB. */
export async function readMachOSlices(path: string): Promise<MachOSlice[]> {
  const fh = await open(path, 'r');
  try {
    return await readMachOSlicesFromReader(async (offset, length) => {
      const buf = Buffer.alloc(length);
      const { bytesRead } = await fh.read(buf, 0, length, offset);
      return buf.subarray(0, bytesRead);
    });
  } finally {
    await fh.close();
  }
}

/** SDK sends 32 hex chars; dwarfdump/Xcode print the dashed form. Accept both. */
export function normalizeUuid(uuid: string): string {
  return uuid.replace(/-/g, '').toUpperCase();
}

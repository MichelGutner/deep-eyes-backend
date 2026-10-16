/** Builds minimal Mach-O images (header + __TEXT segment + LC_UUID) for tests. */
export function buildThinMachO(
  uuidHex: string,
  opts: { cputype?: number; cpusubtype?: number; textVmAddr?: bigint } = {},
): Buffer {
  const segment = Buffer.alloc(72);
  segment.writeUInt32LE(0x19, 0); // LC_SEGMENT_64
  segment.writeUInt32LE(72, 4);
  segment.write('__TEXT', 8, 'latin1');
  segment.writeBigUInt64LE(opts.textVmAddr ?? 0x100000000n, 24);

  const uuid = Buffer.alloc(24);
  uuid.writeUInt32LE(0x1b, 0); // LC_UUID
  uuid.writeUInt32LE(24, 4);
  Buffer.from(uuidHex, 'hex').copy(uuid, 8);

  const header = Buffer.alloc(32);
  header.writeUInt32LE(0xfeedfacf, 0);
  header.writeInt32LE(opts.cputype ?? 0x0100000c, 4); // arm64
  header.writeInt32LE(opts.cpusubtype ?? 0, 8);
  header.writeUInt32LE(0xa, 12); // MH_DSYM
  header.writeUInt32LE(2, 16);
  header.writeUInt32LE(segment.length + uuid.length, 20);

  return Buffer.concat([header, segment, uuid]);
}

export function buildFatMachO(
  slices: Array<{ cputype: number; cpusubtype: number; body: Buffer }>,
): Buffer {
  const headerSize = 8 + slices.length * 20;
  const parts: Buffer[] = [];
  const header = Buffer.alloc(headerSize);
  header.writeUInt32BE(0xcafebabe, 0);
  header.writeUInt32BE(slices.length, 4);
  let offset = 0x1000;
  slices.forEach((slice, i) => {
    const e = 8 + i * 20;
    header.writeInt32BE(slice.cputype, e);
    header.writeInt32BE(slice.cpusubtype, e + 4);
    header.writeUInt32BE(offset, e + 8);
    header.writeUInt32BE(slice.body.length, e + 12);
    header.writeUInt32BE(12, e + 16);
    offset += 0x1000;
  });
  parts.push(header, Buffer.alloc(0x1000 - headerSize));
  for (const slice of slices) {
    parts.push(slice.body, Buffer.alloc(0x1000 - slice.body.length));
  }
  return Buffer.concat(parts);
}

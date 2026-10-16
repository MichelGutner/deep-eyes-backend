import { archName, normalizeUuid, readMachOSlicesFromBuffer } from './macho';
import { buildFatMachO, buildThinMachO } from './test-fixtures';

const UUID_A = '0123456789ABCDEF0123456789ABCDEF';
const UUID_B = 'FEDCBA9876543210FEDCBA9876543210';

describe('macho', () => {
  it('reads UUID, arch and __TEXT vmaddr from a thin 64-bit image', async () => {
    const slices = await readMachOSlicesFromBuffer(
      buildThinMachO(UUID_A, { textVmAddr: 0x100000000n }),
    );
    expect(slices).toEqual([
      { uuid: UUID_A, arch: 'arm64', textVmAddr: 0x100000000n },
    ]);
  });

  it('reads every slice of a fat image', async () => {
    const fat = buildFatMachO([
      {
        cputype: 0x0100000c,
        cpusubtype: 2,
        body: buildThinMachO(UUID_A, { cpusubtype: 2, textVmAddr: 0n }),
      },
      {
        cputype: 0x01000007,
        cpusubtype: 3,
        body: buildThinMachO(UUID_B, { cputype: 0x01000007, cpusubtype: 3 }),
      },
    ]);
    expect(await readMachOSlicesFromBuffer(fat)).toEqual([
      { uuid: UUID_A, arch: 'arm64e', textVmAddr: 0n },
      { uuid: UUID_B, arch: 'x86_64', textVmAddr: 0x100000000n },
    ]);
  });

  it('returns nothing for non Mach-O input', async () => {
    expect(
      await readMachOSlicesFromBuffer(Buffer.from('PK\x03\x04 not a mach-o')),
    ).toEqual([]);
    expect(await readMachOSlicesFromBuffer(Buffer.alloc(4))).toEqual([]);
    // Java class file: same 0xCAFEBABE magic, but a huge "slice count"
    expect(
      await readMachOSlicesFromBuffer(Buffer.from('cafebabe00000037', 'hex')),
    ).toEqual([]);
  });

  it('names architectures', () => {
    expect(archName(0x0100000c, 0)).toBe('arm64');
    expect(archName(0x0100000c, 0x80000002)).toBe('arm64e');
    expect(archName(12, 9)).toBe('armv7');
    expect(archName(7, 3)).toBe('i386');
  });

  it('normalizes dashed UUIDs to the SDK format', () => {
    expect(normalizeUuid('322cb148-c401-3ea0-a023-4b21a104d42f')).toBe(
      '322CB148C4013EA0A0234B21A104D42F',
    );
  });
});

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SymbolStoreService } from './symbol-store.service';
import { buildFatMachO, buildThinMachO } from '../../domain/test-fixtures';

const UUID_A = '0123456789ABCDEF0123456789ABCDEF';
const UUID_B = 'FEDCBA9876543210FEDCBA9876543210';
const APP = 'app-1';

/** In-memory stand-in for prisma.symbolFile, keyed like the real unique index. */
function fakePrisma() {
  const rows = new Map<string, any>();
  let seq = 0;
  const symbolFile = {
    upsert: jest.fn(async ({ where, create, update }) => {
      const k = `${where.application_id_key.application_id}|${where.application_id_key.key}`;
      const existing = rows.get(k);
      const row = existing
        ? {
            ...existing,
            ...update,
            updated_at: new Date(existing.updated_at.getTime() + 1),
          }
        : {
            id: `sym-${++seq}`,
            ...create,
            created_at: new Date(),
            updated_at: new Date(),
          };
      rows.set(k, row);
      return row;
    }),
    findUnique: jest.fn(async ({ where }) => {
      return (
        rows.get(
          `${where.application_id_key.application_id}|${where.application_id_key.key}`,
        ) ?? null
      );
    }),
    findFirst: jest.fn(
      async ({ where }) =>
        [...rows.values()].find(
          (r) => r.id === where.id && r.application_id === where.application_id,
        ) ?? null,
    ),
    findMany: jest.fn(async () => [...rows.values()]),
    delete: jest.fn(async ({ where }) => {
      for (const [k, r] of rows) if (r.id === where.id) rows.delete(k);
    }),
  };
  return { symbolFile, rows };
}

describe('SymbolStoreService', () => {
  let dir: string;
  let prisma: ReturnType<typeof fakePrisma>;
  let store: SymbolStoreService;

  async function tempFile(
    name: string,
    content: string | Buffer,
  ): Promise<string> {
    const p = join(dir, 'uploads', name);
    await mkdir(join(dir, 'uploads'), { recursive: true });
    await writeFile(p, content);
    return p;
  }

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'symbol-store-spec-'));
    process.env.SYMBOLS_DIR = join(dir, 'symbols');
    prisma = fakePrisma();
    store = new SymbolStoreService(prisma as any);
  });

  afterEach(async () => {
    delete process.env.SYMBOLS_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it('stores a mapping per release, parses it on demand and re-parses after a replacement', async () => {
    const v1 = await tempFile(
      'm1',
      'com.x.Foo -> a:\n    1:1:void run():10:10 -> a\n',
    );
    const saved = await store.saveAndroidMapping(APP, '1.2.0', v1);
    expect(saved).toMatchObject({
      type: 'ANDROID_MAPPING',
      key: 'mapping:1.2.0',
      release: '1.2.0',
    });
    expect(existsSync(v1)).toBe(false); // moved, not copied

    expect(
      (await store.getAndroidMapping(APP, '1.2.0'))?.byObfuscated.get('a')
        ?.originalName,
    ).toBe('com.x.Foo');
    expect(await store.getAndroidMapping(APP, '9.9.9')).toBeUndefined();

    await store.saveAndroidMapping(
      APP,
      '1.2.0',
      await tempFile('m2', 'com.x.Bar -> a:\n'),
    );
    expect(
      (await store.getAndroidMapping(APP, '1.2.0'))?.byObfuscated.get('a')
        ?.originalName,
    ).toBe('com.x.Bar');
  });

  it('keeps hostile release names inside SYMBOLS_DIR', async () => {
    const saved = await store.saveAndroidMapping(
      APP,
      '../../../etc/passwd',
      await tempFile('m', 'x'),
    );
    expect(saved.path).not.toContain('..');
    expect(store.absolutePath(saved).startsWith(join(dir, 'symbols'))).toBe(
      true,
    );
  });

  it('indexes a bare DWARF file by UUID', async () => {
    const stored = await store.saveDsym(
      APP,
      await tempFile('dwarf', buildThinMachO(UUID_A)),
    );
    expect(stored).toEqual([{ uuid: UUID_A, arch: 'arm64', name: 'DWARF' }]);
    const row = await store.getDsym(
      APP,
      '01234567-89ab-cdef-0123-456789abcdef',
    );
    expect(row).toMatchObject({
      type: 'IOS_DSYM',
      debug_id: UUID_A,
      arch: 'arm64',
    });
    expect(await readFile(store.absolutePath(row!))).toEqual(
      buildThinMachO(UUID_A),
    );
  });

  (existsSync('/usr/bin/zip') ? it : it.skip)(
    'indexes every slice of every .dSYM in a zip',
    async () => {
      const tree = join(dir, 'archive');
      const dwarfDir = join(
        tree,
        'Entregador.app.dSYM',
        'Contents',
        'Resources',
        'DWARF',
      );
      await mkdir(dwarfDir, { recursive: true });
      await writeFile(
        join(dwarfDir, 'Entregador'),
        buildFatMachO([
          { cputype: 0x0100000c, cpusubtype: 0, body: buildThinMachO(UUID_A) },
          {
            cputype: 0x01000007,
            cpusubtype: 3,
            body: buildThinMachO(UUID_B, {
              cputype: 0x01000007,
              cpusubtype: 3,
            }),
          },
        ]),
      );
      await writeFile(
        join(tree, 'Entregador.app.dSYM', 'Contents', 'Info.plist'),
        '<plist/>',
      );
      const zipPath = join(dir, 'uploads', 'dsyms.zip');
      await mkdir(join(dir, 'uploads'), { recursive: true });
      execFileSync('/usr/bin/zip', ['-qr', zipPath, 'Entregador.app.dSYM'], {
        cwd: tree,
      });

      const stored = await store.saveDsym(APP, zipPath);
      expect(stored).toEqual([
        { uuid: UUID_A, arch: 'arm64', name: 'Entregador' },
        { uuid: UUID_B, arch: 'x86_64', name: 'Entregador' },
      ]);
      expect(existsSync(zipPath)).toBe(false);
      expect((await store.getDsym(APP, UUID_B))?.arch).toBe('x86_64');
    },
  );

  it('returns nothing for an upload that is not a Mach-O', async () => {
    expect(
      await store.saveDsym(APP, await tempFile('junk', 'not a binary')),
    ).toEqual([]);
  });

  it('finds native libs by exact ABI, falling back to an ABI-less upload', async () => {
    await store.saveNativeLib(
      APP,
      '1.0',
      'libapp.so',
      'arm64-v8a',
      await tempFile('a', 'elf-arm64'),
    );
    await store.saveNativeLib(
      APP,
      '1.0',
      'libapp.so',
      undefined,
      await tempFile('b', 'elf-any'),
    );

    const exact = await store.getNativeLib(
      APP,
      '1.0',
      'libapp.so',
      'arm64-v8a',
    );
    expect(await readFile(store.absolutePath(exact!), 'utf8')).toBe(
      'elf-arm64',
    );
    const fallback = await store.getNativeLib(
      APP,
      '1.0',
      'libapp.so',
      'x86_64',
    );
    expect(await readFile(store.absolutePath(fallback!), 'utf8')).toBe(
      'elf-any',
    );
  });

  it('remembers misses briefly, but forgets them as soon as something is uploaded', async () => {
    expect(await store.getAndroidMapping(APP, '2.0')).toBeUndefined();
    expect(await store.getAndroidMapping(APP, '2.0')).toBeUndefined();
    expect(prisma.symbolFile.findUnique).toHaveBeenCalledTimes(1);

    await store.saveAndroidMapping(
      APP,
      '2.0',
      await tempFile('m', 'com.x.Y -> b:\n'),
    );
    expect(await store.getAndroidMapping(APP, '2.0')).toBeDefined();
  });

  it('removes the row and the file', async () => {
    const saved = await store.saveAndroidMapping(
      APP,
      '1.0',
      await tempFile('m', 'x'),
    );
    expect(await store.remove(APP, saved.id)).toBe(true);
    expect(existsSync(store.absolutePath(saved))).toBe(false);
    expect(await store.remove(APP, saved.id)).toBe(false);
    expect(await store.remove('other-app', 'sym-1')).toBe(false);
  });
});

import { SymbolicationService } from './symbolication.service';
import { parseR8Mapping } from '../../domain/r8-retrace';
import * as symbolizer from '../../infrastructure/native-symbolizer';
import * as macho from '../../domain/macho';
import type { ILog } from '@/modules/logs/domain/log.interface';

jest.mock('../../infrastructure/native-symbolizer', () => ({
  ...jest.requireActual('../../infrastructure/native-symbolizer'),
  detectSymbolizerTools: jest.fn(),
  symbolizeWithLlvm: jest.fn(),
  symbolizeWithAtos: jest.fn(),
}));
jest.mock('../../domain/macho', () => ({
  ...jest.requireActual('../../domain/macho'),
  readMachOSlices: jest.fn(),
}));

const tools = symbolizer.detectSymbolizerTools as jest.Mock;
const llvm = symbolizer.symbolizeWithLlvm as jest.Mock;
const atos = symbolizer.symbolizeWithAtos as jest.Mock;
const slices = macho.readMachOSlices as jest.Mock;

const MAPPING = parseR8Mapping(`com.entregador.Checkout -> a.b:
    1:3:void submit():40:42 -> a
com.entregador.CheckoutError -> a.c:
`);

const UUID = '0123456789ABCDEF0123456789ABCDEF';

function makeStore(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    getAndroidMapping: jest.fn().mockResolvedValue(undefined),
    getDsym: jest.fn().mockResolvedValue(null),
    getNativeLib: jest.fn().mockResolvedValue(null),
    absolutePath: jest.fn((f: { path: string }) => `/symbols/${f.path}`),
    ...overrides,
  };
}

const logger = { warn: jest.fn() } as any;

function androidLog(stack: string[], extra: Partial<ILog> = {}): ILog {
  return {
    id: 'log-1',
    release: '1.4.0',
    error: { id: 'e', name: 'a.c', message: 'boom', stack },
    metadata: { platform: 'android', symbolicated: false },
    ...extra,
  };
}

describe('SymbolicationService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    tools.mockResolvedValue({});
  });

  describe('android', () => {
    it('retraces Java frames and the exception class with the release mapping', async () => {
      const store = makeStore({
        getAndroidMapping: jest.fn().mockResolvedValue(MAPPING),
      });
      const log = androidLog([
        'a.b.a(SourceFile:2)',
        'android.os.Looper.loop(Looper.java:288)',
      ]);

      await new SymbolicationService(store as any, logger).symbolicate(
        log,
        'app-1',
      );

      expect(store.getAndroidMapping).toHaveBeenCalledWith('app-1', '1.4.0');
      expect(log.error?.name).toBe('com.entregador.CheckoutError');
      expect(log.error?.stack).toEqual([
        'com.entregador.Checkout.submit(Checkout.java:41)',
        'android.os.Looper.loop(Looper.java:288)',
      ]);
      expect(log.metadata).toMatchObject({
        platform: 'android',
        symbolicated: true,
        symbolicatedWith: ['r8-mapping'],
        rawStack: [
          'a.b.a(SourceFile:2)',
          'android.os.Looper.loop(Looper.java:288)',
        ],
      });
    });

    it('accepts a raw string stack and retraces nested causes', async () => {
      const store = makeStore({
        getAndroidMapping: jest.fn().mockResolvedValue(MAPPING),
      });
      const log = androidLog([]);
      log.error = {
        id: 'e',
        name: 'java.lang.RuntimeException',
        stack:
          'a.b.a(SourceFile:1)\n  \nandroid.os.Looper.loop(Looper.java:288)',
        cause: { id: 'c', name: 'a.c', stack: ['a.b.a(SourceFile:3)'] },
      };

      await new SymbolicationService(store as any, logger).symbolicate(
        log,
        'app-1',
      );

      expect(log.error.stack).toEqual([
        'com.entregador.Checkout.submit(Checkout.java:40)',
        'android.os.Looper.loop(Looper.java:288)',
      ]);
      expect(log.error.cause).toMatchObject({
        name: 'com.entregador.CheckoutError',
        stack: ['com.entregador.Checkout.submit(Checkout.java:42)'],
      });
    });

    it('leaves the log untouched without a mapping for the release', async () => {
      const store = makeStore();
      const log = androidLog(['a.b.a(SourceFile:2)']);
      await new SymbolicationService(store as any, logger).symbolicate(
        log,
        'app-1',
      );
      expect(log.error?.stack).toEqual(['a.b.a(SourceFile:2)']);
      expect(log.metadata).toEqual({
        platform: 'android',
        symbolicated: false,
      });
    });

    it('skips without a release (mapping is per release)', async () => {
      const store = makeStore({
        getAndroidMapping: jest.fn().mockResolvedValue(MAPPING),
      });
      await new SymbolicationService(store as any, logger).symbolicate(
        androidLog(['a.b.a(SourceFile:2)'], { release: undefined }),
        'app-1',
      );
      expect(store.getAndroidMapping).not.toHaveBeenCalled();
    });

    it('resolves NDK frames against the uploaded .so, stepping return addresses back by one', async () => {
      tools.mockResolvedValue({ llvmSymbolizer: '/usr/bin/llvm-symbolizer' });
      llvm.mockResolvedValue([
        { function: 'crash()', file: '/src/native.cpp', line: 42 },
        { function: 'caller()', file: '/src/native.cpp', line: 50 },
      ]);
      const store = makeStore({
        getNativeLib: jest.fn(async (_app, _rel, name) =>
          name === 'libapp.so' ? { path: 'app-1/native-lib/libapp.so' } : null,
        ),
      });
      const log = androidLog([
        '#00 pc 0x0000007a00001d4e  /data/app/x/lib/arm64/libapp.so [rel 0x1d4e] (crash+20)',
        '#01 pc 0x0000007a00002000  /data/app/x/lib/arm64/libapp.so [rel 0x2000]',
        '#02 pc 0x0000007b00000010  /system/lib64/libc.so [rel 0x10]',
      ]);

      await new SymbolicationService(store as any, logger).symbolicate(
        log,
        'app-1',
      );

      expect(store.getNativeLib).toHaveBeenCalledWith(
        'app-1',
        '1.4.0',
        'libapp.so',
        'arm64-v8a',
      );
      // No lib/<abi>/ dir in a system path — looked up ABI-less.
      expect(store.getNativeLib).toHaveBeenCalledWith(
        'app-1',
        '1.4.0',
        'libc.so',
        undefined,
      );
      expect(llvm).toHaveBeenCalledWith(
        '/usr/bin/llvm-symbolizer',
        '/symbols/app-1/native-lib/libapp.so',
        [0x1d4en, 0x1fffn],
      );
      expect(log.error?.stack).toEqual([
        '#00 pc 0x0000007a00001d4e  /data/app/x/lib/arm64/libapp.so [rel 0x1d4e] (crash+20) — crash() (/src/native.cpp:42)',
        '#01 pc 0x0000007a00002000  /data/app/x/lib/arm64/libapp.so [rel 0x2000] — caller() (/src/native.cpp:50)',
        '#02 pc 0x0000007b00000010  /system/lib64/libc.so [rel 0x10]',
      ]);
      expect(log.metadata).toMatchObject({
        symbolicated: true,
        symbolicatedWith: ['native-lib'],
      });
    });

    it('skips NDK frames gracefully when llvm-symbolizer is not installed', async () => {
      const store = makeStore({
        getNativeLib: jest.fn().mockResolvedValue({ path: 'x' }),
      });
      const log = androidLog([
        '#00 pc 0x1  /data/app/x/lib/arm64/libapp.so [rel 0x1d4e]',
      ]);
      await new SymbolicationService(store as any, logger).symbolicate(
        log,
        'app-1',
      );
      expect(store.getNativeLib).not.toHaveBeenCalled();
      expect(log.metadata).toEqual({
        platform: 'android',
        symbolicated: false,
      });
    });
  });

  describe('ios', () => {
    const base = 0x102a00000;
    function iosLog(): ILog {
      return {
        id: 'log-2',
        platform: 'ios',
        error: {
          id: 'e',
          name: 'SIGSEGV',
          stack: [
            `0   Entregador  0x0000000102a4c123 Entregador + 311587`,
            `1   Entregador  0x0000000102a4d000 -[Checkout submit] + 12`,
            `2   libsystem_kernel.dylib  0x00000001e0000010 __pthread_kill + 8`,
          ],
        },
        metadata: {
          platform: 'ios',
          symbolicated: false,
          frameAddresses: [0x102a4c123, 0x102a4d000, 0x1e0000010],
          images: [
            {
              name: '/var/containers/Bundle/Application/X/Entregador.app/Entregador',
              base,
              size: 0x100000,
              uuid: UUID,
            },
            {
              name: '/usr/lib/system/libsystem_kernel.dylib',
              base: 0x1e0000000,
              size: 0x1000,
              uuid: 'AAAA',
            },
          ],
        },
      };
    }
    const dsym = { path: 'app-1/dsym/X', arch: 'arm64', debug_id: UUID };

    it('resolves in-image addresses with llvm-symbolizer, as file offsets on top of __TEXT vmaddr', async () => {
      tools.mockResolvedValue({
        llvmSymbolizer: '/llvm-symbolizer',
        atos: '/usr/bin/atos',
      });
      slices.mockResolvedValue([
        { uuid: UUID, arch: 'arm64', textVmAddr: 0x100000000n },
      ]);
      llvm.mockResolvedValue([
        { function: 'Checkout.crash()', file: 'Checkout.swift', line: 12 },
        { function: '-[Checkout submit]', file: 'Checkout.m', line: 30 },
      ]);
      const store = makeStore({
        getDsym: jest.fn(async (_app, uuid) => (uuid === UUID ? dsym : null)),
      });
      const log = iosLog();

      await new SymbolicationService(store as any, logger).symbolicate(
        log,
        'app-1',
      );

      expect(llvm).toHaveBeenCalledWith(
        '/llvm-symbolizer',
        '/symbols/app-1/dsym/X',
        [0x10004c123n, 0x10004cfffn],
        'arm64',
      );
      expect(atos).not.toHaveBeenCalled();
      expect(log.error?.stack).toEqual([
        '0   Entregador  0x0000000102a4c123 Checkout.crash() (Checkout.swift:12)',
        '1   Entregador  0x0000000102a4d000 -[Checkout submit] (Checkout.m:30)',
        '2   libsystem_kernel.dylib  0x00000001e0000010 __pthread_kill + 8',
      ]);
      expect(log.metadata).toMatchObject({
        symbolicated: true,
        symbolicatedWith: ['dsym'],
      });
    });

    it('falls back to atos with the runtime load address', async () => {
      tools.mockResolvedValue({ atos: '/usr/bin/atos' });
      atos.mockResolvedValue([
        { function: 'Checkout.crash()', file: 'Checkout.swift', line: 12 },
        {},
      ]);
      const store = makeStore({
        getDsym: jest.fn(async (_app, uuid) => (uuid === UUID ? dsym : null)),
      });
      const log = iosLog();

      await new SymbolicationService(store as any, logger).symbolicate(
        log,
        'app-1',
      );

      expect(atos).toHaveBeenCalledWith(
        '/usr/bin/atos',
        '/symbols/app-1/dsym/X',
        BigInt(base),
        [0x102a4c123n, 0x102a4cfffn],
        'arm64',
      );
      expect(log.error?.stack?.[0]).toBe(
        '0   Entregador  0x0000000102a4c123 Checkout.crash() (Checkout.swift:12)',
      );
      expect(log.error?.stack?.[1]).toBe(
        '1   Entregador  0x0000000102a4d000 -[Checkout submit] + 12',
      );
    });

    it('does nothing when no symbolizer is available', async () => {
      const store = makeStore({ getDsym: jest.fn().mockResolvedValue(dsym) });
      const log = iosLog();
      await new SymbolicationService(store as any, logger).symbolicate(
        log,
        'app-1',
      );
      expect(store.getDsym).not.toHaveBeenCalled();
      expect(log.metadata?.symbolicated).toBe(false);
    });

    it('never throws: a symbolizer failure is logged and the log is kept as sent', async () => {
      tools.mockResolvedValue({ atos: '/usr/bin/atos' });
      atos.mockRejectedValue(new Error('atos timed out'));
      const store = makeStore({ getDsym: jest.fn().mockResolvedValue(dsym) });
      const log = iosLog();
      await expect(
        new SymbolicationService(store as any, logger).symbolicate(
          log,
          'app-1',
        ),
      ).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('atos timed out'),
      );
      expect(log.metadata?.symbolicated).toBe(false);
    });
  });

  it('ignores logs without a stack or from other platforms', async () => {
    const store = makeStore({
      getAndroidMapping: jest.fn().mockResolvedValue(MAPPING),
    });
    const service = new SymbolicationService(store as any, logger);
    await service.symbolicate(
      { id: 'x', platform: 'android', release: '1' },
      'app-1',
    );
    await service.symbolicate(
      {
        id: 'y',
        platform: 'web',
        release: '1',
        error: { id: 'e', stack: ['a.b.a(SourceFile:1)'] },
      },
      'app-1',
    );
    expect(store.getAndroidMapping).not.toHaveBeenCalled();
  });
});

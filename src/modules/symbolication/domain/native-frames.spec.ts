import {
  formatLocation,
  normalizeAndroidAbi,
  parseAppleFrame,
  parseNdkFrame,
} from './native-frames';
import {
  parseAtosOutput,
  parseLlvmSymbolizerJson,
} from '../infrastructure/native-symbolizer';

describe('native frames', () => {
  it('parses an NDK frame with lib path, ABI and rel offset', () => {
    expect(
      parseNdkFrame(
        '#03 pc 0x0000007a1b2c3d4e  /data/app/~~ab==/com.entregador-cd==/lib/arm64/libapp.so [rel 0x1d4e] (crash+20)',
      ),
    ).toEqual({
      index: 3,
      libPath: '/data/app/~~ab==/com.entregador-cd==/lib/arm64/libapp.so',
      libName: 'libapp.so',
      abi: 'arm64-v8a',
      relOffset: 0x1d4en,
    });
  });

  it('parses an NDK frame for a lib loaded straight from the APK', () => {
    expect(
      parseNdkFrame(
        '#00 pc 0x1  /data/app/x/base.apk!/lib/armeabi-v7a/libhermes.so [rel 0xabc]',
      ),
    ).toMatchObject({
      libName: 'libhermes.so',
      abi: 'armeabi-v7a',
      relOffset: 0xabcn,
    });
  });

  it('ignores NDK frames without a rel offset (dladdr failed) and non-NDK lines', () => {
    expect(parseNdkFrame('#01 pc 0x0000007a1b2c3d4e')).toBeUndefined();
    expect(parseNdkFrame('a.b.c(SourceFile:1)')).toBeUndefined();
  });

  it('normalizes ABI names', () => {
    expect(normalizeAndroidAbi('arm64')).toBe('arm64-v8a');
    expect(normalizeAndroidAbi('ARM')).toBe('armeabi-v7a');
    expect(normalizeAndroidAbi('x86_64')).toBe('x86_64');
    expect(normalizeAndroidAbi(undefined)).toBeUndefined();
  });

  it.each([
    [
      '3   MyApp                0x0000000102a4c123 -[Foo bar] + 123',
      3,
      'MyApp',
      0x102a4c123n,
    ],
    ['0   MyApp  0x0000000102a4c123 MyApp + 51491', 0, 'MyApp', 0x102a4c123n],
    ['12  ???  0x0000000102a4c123', 12, '???', 0x102a4c123n],
  ])('parses Apple frame %s', (line, index, image, address) => {
    expect(parseAppleFrame(line)).toMatchObject({ index, image, address });
  });

  it('keeps everything up to the address as the frame prefix', () => {
    expect(
      parseAppleFrame('3   MyApp  0x0000000102a4c123 -[Foo bar] + 123')?.prefix,
    ).toBe('3   MyApp  0x0000000102a4c123');
  });

  it('formats locations', () => {
    expect(formatLocation('crash()', '/src/native.cpp', 42)).toBe(
      'crash() (/src/native.cpp:42)',
    );
    expect(formatLocation('crash()', undefined, undefined)).toBe('crash()');
    expect(formatLocation(undefined, 'a.cpp', undefined)).toBe('??? (a.cpp)');
  });

  describe('tool output parsing', () => {
    it('parses llvm-symbolizer JSON (array and per-line forms), taking the innermost inline frame', () => {
      const array = JSON.stringify([
        {
          Address: '0x1d4d',
          Symbol: [
            { FunctionName: 'inlined()', FileName: '/src/a.cpp', Line: 7 },
            { FunctionName: 'crash()', FileName: '/src/a.cpp', Line: 42 },
          ],
        },
        {
          Address: '0x9999',
          Symbol: [{ FunctionName: '??', FileName: '??', Line: 0 }],
        },
      ]);
      const expected = [
        { function: 'inlined()', file: '/src/a.cpp', line: 7 },
        { function: undefined, file: undefined, line: undefined },
      ];
      expect(parseLlvmSymbolizerJson(array)).toEqual(expected);
      const perLine = JSON.parse(array)
        .map((e: unknown) => JSON.stringify(e))
        .join('\n');
      expect(parseLlvmSymbolizerJson(perLine)).toEqual(expected);
    });

    it('parses atos output with and without line info', () => {
      expect(
        parseAtosOutput(
          [
            '-[CheckoutViewController submit:] (in Entregador) (CheckoutViewController.m:42)',
            'closure #1 in Foo.run() (in Entregador) (Foo.swift:12)',
            'main (in Entregador) + 40',
            '0x0000000102a4c123',
          ].join('\n'),
        ),
      ).toEqual([
        {
          function: '-[CheckoutViewController submit:]',
          file: 'CheckoutViewController.m',
          line: 42,
        },
        { function: 'closure #1 in Foo.run()', file: 'Foo.swift', line: 12 },
        { function: 'main' },
        {},
      ]);
    });
  });
});

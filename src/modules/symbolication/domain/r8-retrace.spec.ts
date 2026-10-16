import {
  parseJavaFrame,
  parseR8Mapping,
  retraceClassName,
  retraceFrame,
  retraceStack,
} from './r8-retrace';

const MAPPING = `# compiler: R8
# compiler_version: 8.5.35
# {"id":"com.android.tools.r8.mapping","version":"2.2"}
com.entregador.checkout.CheckoutViewModel -> a.b.c:
# {"id":"sourceFile","fileName":"CheckoutViewModel.kt"}
    java.lang.String orderId -> a
    1:3:void submitOrder(java.lang.String,int):40:42 -> a
    4:4:void validate(com.entregador.checkout.Order):88:88 -> a
    4:4:void submitOrder(java.lang.String,int):43 -> a
    5:5:void com.entregador.util.Guard.require(boolean):12:12 -> a
    5:5:void submitOrder(java.lang.String,int):44 -> a
    10:20:void <init>():15:25 -> <init>
    void onCleared() -> b
    6:6:java.util.List items():60 -> c
com.entregador.util.Guard -> a.d:
# {"id":"sourceFile","fileName":"Guard.kt"}
    1:1:void require(boolean):12:12 -> a
com.entregador.Plain -> a.e:
    7:9:void run():100:102 -> a
com.entregador.Plain$Inner -> a.f:
    1:1:void go():5:5 -> a
`;

describe('r8 retrace', () => {
  const mapping = parseR8Mapping(MAPPING);

  describe('parseR8Mapping', () => {
    it('indexes classes by obfuscated and original name, with the sourceFile annotation', () => {
      const cls = mapping.byObfuscated.get('a.b.c');
      expect(cls?.originalName).toBe(
        'com.entregador.checkout.CheckoutViewModel',
      );
      expect(cls?.sourceFile).toBe('CheckoutViewModel.kt');
      expect(
        mapping.byOriginal.get('com.entregador.util.Guard')?.obfuscatedName,
      ).toBe('a.d');
      expect(mapping.byObfuscated.get('a.e')?.sourceFile).toBeUndefined();
    });

    it('keeps members in file order and ignores fields', () => {
      const members = mapping.byObfuscated.get('a.b.c')!.methods.get('a')!;
      expect(members).toHaveLength(5);
      expect(members[0]).toEqual({
        obfStart: 1,
        obfEnd: 3,
        originalName: 'submitOrder',
        origStart: 40,
        origEnd: 42,
      });
      expect(members[2]).toMatchObject({
        originalName: 'submitOrder',
        origStart: 43,
        origEnd: undefined,
      });
    });

    it('tolerates CRLF line endings and junk lines', () => {
      const m = parseR8Mapping(
        'garbage line\r\ncom.x.Y -> q:\r\n    1:1:void z():9:9 -> a\r\n',
      );
      expect(
        retraceFrame(m, {
          className: 'q',
          methodName: 'a',
          fileName: 'SourceFile',
          line: 1,
        }),
      ).toEqual([
        { className: 'com.x.Y', methodName: 'z', fileName: 'Y.java', line: 9 },
      ]);
    });
  });

  describe('parseJavaFrame', () => {
    it.each([
      [
        'a.b.c.a(SourceFile:2)',
        {
          className: 'a.b.c',
          methodName: 'a',
          fileName: 'SourceFile',
          line: 2,
        },
      ],
      [
        'at a.b.c.a(SourceFile:2)',
        {
          className: 'a.b.c',
          methodName: 'a',
          fileName: 'SourceFile',
          line: 2,
        },
      ],
      [
        'a.b.c.<init>(Unknown Source:12)',
        {
          className: 'a.b.c',
          methodName: '<init>',
          fileName: 'Unknown Source',
          line: 12,
        },
      ],
      [
        'a.b.c.b(Unknown Source)',
        {
          className: 'a.b.c',
          methodName: 'b',
          fileName: 'Unknown Source',
          line: undefined,
        },
      ],
      [
        'java.lang.Thread.run(Thread.java:1012)',
        {
          className: 'java.lang.Thread',
          methodName: 'run',
          fileName: 'Thread.java',
          line: 1012,
        },
      ],
      [
        'app//a.b.c.a(SourceFile:2)',
        {
          className: 'a.b.c',
          methodName: 'a',
          fileName: 'SourceFile',
          line: 2,
        },
      ],
      [
        'a.f$a.invoke(SourceFile:3)',
        {
          className: 'a.f$a',
          methodName: 'invoke',
          fileName: 'SourceFile',
          line: 3,
        },
      ],
    ])('parses %s', (line, expected) => {
      expect(parseJavaFrame(line)).toEqual(expected);
    });

    it.each([
      'at foo (http://localhost:8081/index.bundle:1:2)',
      '#00 pc 0x0000000000012345  /data/app/lib/arm64/libapp.so [rel 0x12345]',
      '3   MyApp   0x0000000102a4c123 -[Foo bar] + 123',
      'Caused by: java.lang.IllegalStateException: boom',
    ])('rejects non-Java frame %s', (line) => {
      expect(parseJavaFrame(line)).toBeUndefined();
    });
  });

  describe('retraceFrame', () => {
    it('maps a line inside a range to the original line', () => {
      expect(
        retraceFrame(mapping, {
          className: 'a.b.c',
          methodName: 'a',
          fileName: 'SourceFile',
          line: 2,
        }),
      ).toEqual([
        {
          className: 'com.entregador.checkout.CheckoutViewModel',
          methodName: 'submitOrder',
          fileName: 'CheckoutViewModel.kt',
          line: 41,
        },
      ]);
    });

    it('expands an inline stack, innermost frame first, with the caller pinned to the call-site line', () => {
      expect(
        retraceFrame(mapping, {
          className: 'a.b.c',
          methodName: 'a',
          fileName: 'SourceFile',
          line: 4,
        }),
      ).toEqual([
        {
          className: 'com.entregador.checkout.CheckoutViewModel',
          methodName: 'validate',
          fileName: 'CheckoutViewModel.kt',
          line: 88,
        },
        {
          className: 'com.entregador.checkout.CheckoutViewModel',
          methodName: 'submitOrder',
          fileName: 'CheckoutViewModel.kt',
          line: 43,
        },
      ]);
    });

    it('resolves methods inlined from another class to that class and its source file', () => {
      expect(
        retraceFrame(mapping, {
          className: 'a.b.c',
          methodName: 'a',
          fileName: 'SourceFile',
          line: 5,
        }),
      ).toEqual([
        {
          className: 'com.entregador.util.Guard',
          methodName: 'require',
          fileName: 'Guard.kt',
          line: 12,
        },
        {
          className: 'com.entregador.checkout.CheckoutViewModel',
          methodName: 'submitOrder',
          fileName: 'CheckoutViewModel.kt',
          line: 44,
        },
      ]);
    });

    it('handles constructors and ranges that start past 1', () => {
      expect(
        retraceFrame(mapping, {
          className: 'a.b.c',
          methodName: '<init>',
          fileName: 'SourceFile',
          line: 13,
        }),
      ).toEqual([
        {
          className: 'com.entregador.checkout.CheckoutViewModel',
          methodName: '<init>',
          fileName: 'CheckoutViewModel.kt',
          line: 18,
        },
      ]);
    });

    it('passes the line through for members without line info', () => {
      expect(
        retraceFrame(mapping, {
          className: 'a.b.c',
          methodName: 'b',
          fileName: 'SourceFile',
          line: 77,
        }),
      ).toEqual([
        {
          className: 'com.entregador.checkout.CheckoutViewModel',
          methodName: 'onCleared',
          fileName: 'CheckoutViewModel.kt',
          line: 77,
        },
      ]);
    });

    it('maps every obfuscated line to a single original line when only one is recorded', () => {
      expect(
        retraceFrame(mapping, {
          className: 'a.b.c',
          methodName: 'c',
          fileName: 'SourceFile',
          line: 6,
        }),
      ).toEqual([
        {
          className: 'com.entregador.checkout.CheckoutViewModel',
          methodName: 'items',
          fileName: 'CheckoutViewModel.kt',
          line: 60,
        },
      ]);
    });

    it('keeps the method but drops an untrustworthy line when it falls outside every range', () => {
      expect(
        retraceFrame(mapping, {
          className: 'a.e',
          methodName: 'a',
          fileName: 'SourceFile',
          line: 50,
        }),
      ).toEqual([
        {
          className: 'com.entregador.Plain',
          methodName: 'run',
          fileName: 'Plain.java',
          line: undefined,
        },
      ]);
    });

    it('resolves the method when the frame has no line number', () => {
      expect(
        retraceFrame(mapping, {
          className: 'a.e',
          methodName: 'a',
          fileName: 'Unknown Source',
        }),
      ).toEqual([
        {
          className: 'com.entregador.Plain',
          methodName: 'run',
          fileName: 'Plain.java',
          line: undefined,
        },
      ]);
    });

    it('derives the source file of an inner class from its outer class', () => {
      expect(
        retraceFrame(mapping, {
          className: 'a.f',
          methodName: 'a',
          fileName: 'SourceFile',
          line: 1,
        }),
      ).toEqual([
        {
          className: 'com.entregador.Plain$Inner',
          methodName: 'go',
          fileName: 'Plain.java',
          line: 5,
        },
      ]);
    });

    it('deobfuscates only the class when the method is not in the mapping', () => {
      expect(
        retraceFrame(mapping, {
          className: 'a.b.c',
          methodName: 'zz',
          fileName: 'SourceFile',
          line: 3,
        }),
      ).toEqual([
        {
          className: 'com.entregador.checkout.CheckoutViewModel',
          methodName: 'zz',
          fileName: 'CheckoutViewModel.kt',
          line: 3,
        },
      ]);
    });

    it('returns undefined for classes the mapping does not know', () => {
      expect(
        retraceFrame(mapping, {
          className: 'android.os.Handler',
          methodName: 'dispatchMessage',
          fileName: 'Handler.java',
          line: 106,
        }),
      ).toBeUndefined();
    });
  });

  describe('retraceStack', () => {
    it('rewrites known frames, expands inlines and leaves everything else alone', () => {
      const result = retraceStack(mapping, [
        'a.b.c.a(SourceFile:5)',
        'a.b.c.a(SourceFile:1)',
        'android.os.Handler.dispatchMessage(Handler.java:106)',
        'at a.e.a(SourceFile:8)',
        'not a frame at all',
      ]);
      expect(result.retracedFrames).toBe(3);
      expect(result.lines).toEqual([
        'com.entregador.util.Guard.require(Guard.kt:12)',
        'com.entregador.checkout.CheckoutViewModel.submitOrder(CheckoutViewModel.kt:44)',
        'com.entregador.checkout.CheckoutViewModel.submitOrder(CheckoutViewModel.kt:40)',
        'android.os.Handler.dispatchMessage(Handler.java:106)',
        'at com.entregador.Plain.run(Plain.java:101)',
        'not a frame at all',
      ]);
    });

    it('reports zero retraced frames when nothing matches', () => {
      const result = retraceStack(mapping, [
        'java.lang.Thread.run(Thread.java:1012)',
      ]);
      expect(result).toEqual({
        lines: ['java.lang.Thread.run(Thread.java:1012)'],
        retracedFrames: 0,
      });
    });
  });

  it('retraceClassName deobfuscates exception class names and leaves unknown ones', () => {
    expect(retraceClassName(mapping, 'a.d')).toBe('com.entregador.util.Guard');
    expect(retraceClassName(mapping, 'java.lang.NullPointerException')).toBe(
      'java.lang.NullPointerException',
    );
  });
});

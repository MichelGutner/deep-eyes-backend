/**
 * Parsing for the native frame lines the React Native SDK writes into `error.stack`.
 *
 * Android NDK (tombstone style, from the C++ signal handler):
 *   #00 pc 0x0000007a1b2c3d4e  /data/app/~~x/com.app-y/lib/arm64/libapp.so [rel 0x1d4e] (crash+20)
 *
 * iOS (NSException callStackSymbols, or the SDK's own relaunch symbolication):
 *   3   MyApp   0x0000000102a4c123 -[Foo bar] + 123
 *   3   MyApp  0x0000000102a4c123 MyApp + 51491
 */

export interface NdkFrame {
  index: number;
  libPath: string;
  libName: string;
  /** ABI from the lib path (`lib/arm64/` or `lib/arm64-v8a/`), normalized to the NDK ABI name. */
  abi?: string;
  relOffset: bigint;
}

const NDK_FRAME = /^#(\d+) pc 0x[0-9a-f]+\s+(\S+) \[rel 0x([0-9a-f]+)\]/i;

const ABI_ALIASES: Record<string, string> = {
  arm64: 'arm64-v8a',
  aarch64: 'arm64-v8a',
  'arm64-v8a': 'arm64-v8a',
  arm: 'armeabi-v7a',
  armv7: 'armeabi-v7a',
  'armeabi-v7a': 'armeabi-v7a',
  x86: 'x86',
  i686: 'x86',
  x86_64: 'x86_64',
  x64: 'x86_64',
};

export function normalizeAndroidAbi(
  abi: string | undefined,
): string | undefined {
  if (!abi) return undefined;
  return ABI_ALIASES[abi.toLowerCase()] ?? abi.toLowerCase();
}

export function parseNdkFrame(line: string): NdkFrame | undefined {
  const m = NDK_FRAME.exec(line.trim());
  if (!m) return undefined;
  const libPath = m[2];
  // Libs loaded straight from the APK show up as `base.apk!/lib/arm64-v8a/libapp.so`.
  const segments = libPath.split(/[/!]+/).filter(Boolean);
  const libName = segments[segments.length - 1];
  const libDir =
    segments.length >= 3 && segments[segments.length - 3] === 'lib'
      ? segments[segments.length - 2]
      : undefined;
  return {
    index: Number(m[1]),
    libPath,
    libName,
    abi: normalizeAndroidAbi(libDir),
    relOffset: BigInt(`0x${m[3]}`),
  };
}

export interface AppleFrame {
  index: number;
  image: string;
  address: bigint;
  /** Everything up to and including the address — kept when the symbol part is rewritten. */
  prefix: string;
}

const APPLE_FRAME = /^((\d+)\s+(\S+)\s+0x([0-9a-f]+))(?:\s|$)/i;

export function parseAppleFrame(line: string): AppleFrame | undefined {
  const m = APPLE_FRAME.exec(line.trim());
  if (!m) return undefined;
  return {
    index: Number(m[2]),
    image: m[3],
    address: BigInt(`0x${m[4]}`),
    prefix: m[1],
  };
}

export function formatLocation(
  fn: string | undefined,
  file: string | undefined,
  line: number | undefined,
): string {
  const where = file ? ` (${file}${line ? `:${line}` : ''})` : '';
  return `${fn ?? '???'}${where}`;
}

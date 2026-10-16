/**
 * Minimal R8/ProGuard retrace: parses a `mapping.txt` and maps obfuscated Java frames
 * (`a.b.c(SourceFile:12)`, what `StackTraceElement.toString()` prints) back to the
 * original class, method, source file and line.
 *
 * Mapping format (one class header, then indented members):
 *
 *   com.example.Foo -> a.b:
 *   # {"id":"sourceFile","fileName":"Foo.kt"}
 *       int count -> a
 *       1:3:void bar(int):10:12 -> c        line range: obf 1..3 → original 10..12
 *       4:4:void inlined():20:20 -> c       ┐ same obf range + name = one inline stack,
 *       4:4:void bar(int):11 -> c           ┘ innermost first; a lone original line pins all
 *       void baz() -> d                     no line info: line passes through unchanged
 *       5:5:void com.other.Util.qux():7 -> e   method inlined from another class
 */

export interface R8MemberMapping {
  obfStart?: number;
  obfEnd?: number;
  /** Original method name; may be qualified (`com.other.Util.qux`) when inlined from another class. */
  originalName: string;
  origStart?: number;
  origEnd?: number;
}

export interface R8ClassMapping {
  originalName: string;
  obfuscatedName: string;
  sourceFile?: string;
  /** Members by obfuscated method name, in file order (inline stacks rely on that order). */
  methods: Map<string, R8MemberMapping[]>;
}

export interface R8Mapping {
  byObfuscated: Map<string, R8ClassMapping>;
  byOriginal: Map<string, R8ClassMapping>;
}

export interface JavaFrame {
  className: string;
  methodName: string;
  /** `SourceFile`, `Unknown Source`, `Native Method`, `Foo.java`… */
  fileName?: string;
  line?: number;
}

const CLASS_LINE = /^(\S+) -> (\S+):$/;
// [obfStart:obfEnd:]type name(args)[:origStart[:origEnd]] -> obfName
const METHOD_LINE =
  /^(?:(\d+):(\d+):)?[^\s(]+\s+([^\s(]+)\([^)]*\)(?::(\d+)(?::(\d+))?)?\s+->\s+(\S+)$/;
const SOURCE_FILE_COMMENT = /^#\s*(\{.*\})\s*$/;

export function parseR8Mapping(text: string): R8Mapping {
  const byObfuscated = new Map<string, R8ClassMapping>();
  const byOriginal = new Map<string, R8ClassMapping>();
  let current: R8ClassMapping | undefined;
  let sawMember = false;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!line.trim()) continue;

    const indented = /^\s/.test(line);
    const trimmed = line.trim();

    if (trimmed.startsWith('#')) {
      // Only the sourceFile annotation right under a class header matters here.
      if (current && !sawMember) {
        const meta = SOURCE_FILE_COMMENT.exec(trimmed);
        if (meta) {
          try {
            const parsed = JSON.parse(meta[1]) as {
              id?: string;
              fileName?: string;
            };
            if (parsed.id === 'sourceFile' && parsed.fileName)
              current.sourceFile = parsed.fileName;
          } catch {
            // Malformed metadata comment — ignore, it only refines the file name.
          }
        }
      }
      continue;
    }

    if (!indented) {
      const cls = CLASS_LINE.exec(trimmed);
      if (!cls) {
        current = undefined;
        continue;
      }
      current = {
        originalName: cls[1],
        obfuscatedName: cls[2],
        methods: new Map(),
      };
      sawMember = false;
      byObfuscated.set(current.obfuscatedName, current);
      byOriginal.set(current.originalName, current);
      continue;
    }

    if (!current) continue;
    sawMember = true;

    const m = METHOD_LINE.exec(trimmed);
    if (!m) continue; // field mapping or something we don't need

    const member: R8MemberMapping = {
      obfStart: m[1] !== undefined ? Number(m[1]) : undefined,
      obfEnd: m[2] !== undefined ? Number(m[2]) : undefined,
      originalName: m[3],
      origStart: m[4] !== undefined ? Number(m[4]) : undefined,
      origEnd: m[5] !== undefined ? Number(m[5]) : undefined,
    };
    const obfName = m[6];
    const list = current.methods.get(obfName);
    if (list) list.push(member);
    else current.methods.set(obfName, [member]);
  }

  return { byObfuscated, byOriginal };
}

// `com.a.b.c(SourceFile:12)`, optionally prefixed by `at ` and/or a module (`app//`, `java.base/`).
const JAVA_FRAME =
  /^(\s*at\s+)?(?:[\w.$-]*\/+)?([\w$.<>-]+)\.([\w$<>-]+)\(([^()]*)\)\s*$/;

export function parseJavaFrame(line: string): JavaFrame | undefined {
  const m = JAVA_FRAME.exec(line);
  if (!m) return undefined;
  const location = m[4];
  const colon = location.lastIndexOf(':');
  let fileName: string | undefined = location || undefined;
  let lineNo: number | undefined;
  if (colon >= 0 && /^\d+$/.test(location.slice(colon + 1))) {
    fileName = location.slice(0, colon) || undefined;
    lineNo = Number(location.slice(colon + 1));
  }
  return { className: m[2], methodName: m[3], fileName, line: lineNo };
}

export function formatJavaFrame(frame: JavaFrame): string {
  const location =
    frame.line !== undefined
      ? `${frame.fileName ?? 'Unknown Source'}:${frame.line}`
      : (frame.fileName ?? 'Unknown Source');
  return `${frame.className}.${frame.methodName}(${location})`;
}

function inRange(member: R8MemberMapping, line: number): boolean {
  return (
    member.obfStart !== undefined &&
    member.obfEnd !== undefined &&
    line >= member.obfStart &&
    line <= member.obfEnd
  );
}

function sameRange(a: R8MemberMapping, b: R8MemberMapping): boolean {
  return a.obfStart === b.obfStart && a.obfEnd === b.obfEnd;
}

function originalLine(
  member: R8MemberMapping,
  obfLine: number | undefined,
): number | undefined {
  if (member.origStart === undefined) {
    // No original range recorded: R8 kept the line as-is (or there was no line at all).
    return obfLine;
  }
  if (
    member.origEnd === undefined ||
    obfLine === undefined ||
    member.obfStart === undefined
  ) {
    // Single original line: every obfuscated line in the range maps to it (inline call site).
    return member.origStart;
  }
  // Ranges of different size can't be interpolated meaningfully — clamp to the start.
  if (
    member.origEnd - member.origStart !==
    (member.obfEnd ?? member.obfStart) - member.obfStart
  ) {
    return member.origStart;
  }
  return member.origStart + (obfLine - member.obfStart);
}

function defaultSourceFile(className: string): string {
  const simple = className.slice(className.lastIndexOf('.') + 1);
  const outer = simple.split('$')[0];
  return `${outer}.java`;
}

function sourceFileFor(mapping: R8Mapping, className: string): string {
  return (
    mapping.byOriginal.get(className)?.sourceFile ??
    defaultSourceFile(className)
  );
}

/**
 * Retraces one frame. Returns several frames when R8 inlined methods into the obfuscated
 * one (innermost first, as the JVM would have printed them without inlining), or
 * undefined when the class isn't in the mapping.
 */
export function retraceFrame(
  mapping: R8Mapping,
  frame: JavaFrame,
): JavaFrame[] | undefined {
  const cls = mapping.byObfuscated.get(frame.className);
  if (!cls) return undefined;

  const members = cls.methods.get(frame.methodName) ?? [];

  let group: R8MemberMapping[] = [];
  if (frame.line !== undefined) {
    const first = members.findIndex((mm) => inRange(mm, frame.line!));
    if (first >= 0) {
      group = [members[first]];
      for (
        let i = first + 1;
        i < members.length && sameRange(members[i], members[first]);
        i++
      ) {
        group.push(members[i]);
      }
    }
  }
  if (!group.length) {
    // Line unknown or outside every range: fall back to a range-less entry, then to any
    // entry for the name (the method is right even if the line can't be trusted).
    const rangeless = members.find((mm) => mm.obfStart === undefined);
    const fallback = rangeless ?? members[0];
    if (fallback) group = [fallback];
  }

  if (!group.length) {
    // Method not in the mapping (kept name, or synthetic): only the class is deobfuscated.
    return [
      {
        className: cls.originalName,
        methodName: frame.methodName,
        fileName: cls.sourceFile ?? defaultSourceFile(cls.originalName),
        line: frame.line,
      },
    ];
  }

  return group.map((member) => {
    const dot = member.originalName.lastIndexOf('.');
    const className =
      dot >= 0 ? member.originalName.slice(0, dot) : cls.originalName;
    const methodName =
      dot >= 0 ? member.originalName.slice(dot + 1) : member.originalName;
    const lineInRange = frame.line !== undefined && inRange(member, frame.line);
    return {
      className,
      methodName,
      fileName: sourceFileFor(mapping, className),
      line:
        lineInRange || member.obfStart === undefined
          ? originalLine(member, frame.line)
          : undefined,
    };
  });
}

export interface RetraceResult {
  lines: string[];
  /** Number of input frames that were found in the mapping. */
  retracedFrames: number;
}

/** Retraces every Java frame line in a stack; lines that aren't frames pass through untouched. */
export function retraceStack(
  mapping: R8Mapping,
  lines: string[],
): RetraceResult {
  const out: string[] = [];
  let retracedFrames = 0;

  for (const line of lines) {
    const frame = parseJavaFrame(line);
    const retraced = frame ? retraceFrame(mapping, frame) : undefined;
    if (!frame || !retraced) {
      out.push(line);
      continue;
    }
    retracedFrames++;
    const prefix = /^\s*at\s+/.exec(line)?.[0] ?? '';
    for (const f of retraced) out.push(prefix + formatJavaFrame(f));
  }

  return { lines: out, retracedFrames };
}

/** Deobfuscates a bare class name, e.g. the exception class in `error.name`. */
export function retraceClassName(mapping: R8Mapping, name: string): string {
  return mapping.byObfuscated.get(name)?.originalName ?? name;
}

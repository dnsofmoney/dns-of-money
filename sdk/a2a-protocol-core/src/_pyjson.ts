/**
 * Faithful port of Python's `json.dumps(value, sort_keys=True)` *default* output,
 * so canonical/semantic hashes computed here are BYTE-IDENTICAL to the Python
 * `a2a-protocol-core` reference implementation.
 *
 * The non-obvious things this preserves vs. the native `JSON.stringify`:
 *   1. Separators carry spaces: items joined by ", " and keys by ": "
 *      (Python's default when `indent` is None).
 *   2. `ensure_ascii=True`: every code point outside 0x20..0x7E is escaped as
 *      \uXXXX (surrogate pairs for astral chars, DEL as \u007f), exactly as
 *      CPython does.
 *   3. Python number text: ints print all their digits (bigint supported), and
 *      floats print Python's `repr` (`10.0`, `1e+16`, `1e-05`, `-0.0`).
 *
 * Keys are sorted. For the protocol's field names (all ASCII) JS's default
 * code-unit sort equals Python's code-point sort.
 *
 * Numbers — the int/float split: JS has one number type, Python has two. Here a
 * plain JS `number` with an integer value is a Python int, and any other plain
 * `number` is a Python float. To send a Python float with an integer value
 * (`10.0`), wrap it with `pyFloat(10)`. A `bigint` is a Python int of any size.
 * `parsePyJson` decodes JSON text the way Python `json.loads` does, so it keeps
 * `10` and `10.0` apart and keeps big ints exact.
 */

/** A number that Python must see as a `float`, even when its value is integral. */
export class PyFloat {
  constructor(readonly value: number) {}
}

/** Mark `value` as a Python float (`pyFloat(10)` hashes as `10.0`). */
export function pyFloat(value: number): PyFloat {
  return new PyFloat(value);
}

/** Python `repr(float)`: shortest round-trip digits, Python's exponent rules. */
export function pyFloatRepr(value: number): string {
  if (Number.isNaN(value)) return "nan";
  if (value === Infinity) return "inf";
  if (value === -Infinity) return "-inf";
  if (value === 0) return Object.is(value, -0) ? "-0.0" : "0.0";

  const sign = value < 0 ? "-" : "";
  // toExponential() with no argument gives the shortest digits that round-trip,
  // the same digits CPython's repr picks.
  const [mantissa, expText] = Math.abs(value).toExponential().split("e");
  const digits = mantissa.replace(".", "");
  const exp = Number(expText);
  const decpt = exp + 1; // value = 0.<digits> * 10**decpt

  if (decpt <= -4 || decpt > 16) {
    const body = digits.length === 1 ? digits : digits[0] + "." + digits.slice(1);
    const expSign = exp < 0 ? "-" : "+";
    return sign + body + "e" + expSign + String(Math.abs(exp)).padStart(2, "0");
  }
  if (decpt <= 0) {
    return sign + "0." + "0".repeat(-decpt) + digits;
  }
  if (digits.length <= decpt) {
    return sign + digits + "0".repeat(decpt - digits.length) + ".0";
  }
  return sign + digits.slice(0, decpt) + "." + digits.slice(decpt);
}

/**
 * Python `str()` of an int or float value, or `undefined` if `value` is not a
 * number. A boolean is a Python int subclass, so `true` gives "True".
 */
export function pyNumberStr(value: unknown): string | undefined {
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "bigint") return value.toString();
  if (value instanceof PyFloat) return pyFloatRepr(value.value);
  if (typeof value === "number") {
    return Number.isInteger(value) ? BigInt(value).toString() : pyFloatRepr(value);
  }
  return undefined;
}

/** Deep copy that keeps `PyFloat` markers (structuredClone drops the class). */
export function pyClone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(pyClone) as T;
  if (value !== null && typeof value === "object" && !(value instanceof PyFloat)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = pyClone(v);
    return out as T;
  }
  return value;
}

function escapeString(s: string): string {
  let out = '"';
  for (const ch of s) {
    const code = ch.codePointAt(0) as number;
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\b") out += "\\b";
    else if (ch === "\f") out += "\\f";
    else if (code >= 0x20 && code < 0x7f) out += ch;
    else if (code <= 0xffff) out += "\\u" + code.toString(16).padStart(4, "0");
    else {
      const c = code - 0x10000;
      const hi = 0xd800 + (c >> 10);
      const lo = 0xdc00 + (c & 0x3ff);
      out += "\\u" + hi.toString(16).padStart(4, "0") + "\\u" + lo.toString(16).padStart(4, "0");
    }
  }
  return out + '"';
}

function dumpNumber(value: number): string {
  // json.dumps writes float('nan') / float('inf') as NaN / Infinity.
  if (Number.isNaN(value)) return "NaN";
  if (value === Infinity) return "Infinity";
  if (value === -Infinity) return "-Infinity";
  return pyNumberStr(value) as string;
}

function dump(value: unknown, sortKeys: boolean): string {
  if (value === null || value === undefined) return "null";
  if (value instanceof PyFloat) return Number.isFinite(value.value) ? pyFloatRepr(value.value) : dumpNumber(value.value);
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      return dumpNumber(value);
    case "bigint":
      return value.toString();
    case "string":
      return escapeString(value);
    case "object": {
      if (Array.isArray(value)) {
        return "[" + value.map((v) => dump(v, sortKeys)).join(", ") + "]";
      }
      const obj = value as Record<string, unknown>;
      const keys = sortKeys ? Object.keys(obj).sort() : Object.keys(obj);
      return "{" + keys.map((k) => escapeString(k) + ": " + dump(obj[k], sortKeys)).join(", ") + "}";
    }
    default:
      throw new Error(`pyJsonDumps: cannot serialize ${typeof value}`);
  }
}

/**
 * Serialize like Python `json.dumps(value, sort_keys=True)` (default separators,
 * ensure_ascii). Pass `sortKeys: false` to mirror a bare `json.dumps(value)`,
 * which keeps insertion order.
 */
export function pyJsonDumps(value: unknown, options: { sortKeys?: boolean } = {}): string {
  return dump(value, options.sortKeys ?? true);
}

/**
 * Parse JSON text the way Python `json.loads` does: a number with a `.` or an
 * exponent becomes a `PyFloat`, any other number becomes an int (a `number` when
 * it is a safe integer, else a `bigint`). Use it to hash JSON text that came
 * from a Python agent without losing `10.0` or digits above 2**53.
 */
export function parsePyJson(text: string): unknown {
  let i = 0;

  const fail = (msg: string): never => {
    throw new SyntaxError(`parsePyJson: ${msg} at position ${i}`);
  };
  const ws = () => {
    while (i < text.length && " \t\n\r".includes(text[i])) i++;
  };

  const parseString = (): string => {
    const start = i;
    i++; // opening quote
    while (i < text.length && text[i] !== '"') {
      if (text[i] === "\\") i++;
      i++;
    }
    if (i >= text.length) fail("unterminated string");
    i++; // closing quote
    // The escapes JSON allows are the same in JS and Python; JSON.parse keeps
    // lone surrogates as UTF-16 code units, like Python keeps them as code points.
    return JSON.parse(text.slice(start, i)) as string;
  };

  const parseNumber = (): unknown => {
    const m = /^-?(?:0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i));
    if (!m) fail("bad number");
    const lexeme = (m as RegExpExecArray)[0];
    i += lexeme.length;
    if (m![1] !== undefined || m![2] !== undefined) return new PyFloat(Number(lexeme));
    const n = Number(lexeme);
    return Number.isSafeInteger(n) ? n : BigInt(lexeme);
  };

  const parseValue = (): unknown => {
    ws();
    const ch = text[i];
    if (ch === "{") {
      i++;
      const obj: Record<string, unknown> = {};
      ws();
      if (text[i] === "}") {
        i++;
        return obj;
      }
      for (;;) {
        ws();
        if (text[i] !== '"') fail("expected key");
        const key = parseString();
        ws();
        if (text[i] !== ":") fail("expected ':'");
        i++;
        obj[key] = parseValue();
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "}") {
          i++;
          return obj;
        }
        fail("expected ',' or '}'");
      }
    }
    if (ch === "[") {
      i++;
      const arr: unknown[] = [];
      ws();
      if (text[i] === "]") {
        i++;
        return arr;
      }
      for (;;) {
        arr.push(parseValue());
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "]") {
          i++;
          return arr;
        }
        fail("expected ',' or ']'");
      }
    }
    if (ch === '"') return parseString();
    if (text.startsWith("true", i)) {
      i += 4;
      return true;
    }
    if (text.startsWith("false", i)) {
      i += 5;
      return false;
    }
    if (text.startsWith("null", i)) {
      i += 4;
      return null;
    }
    return parseNumber();
  };

  const result = parseValue();
  ws();
  if (i !== text.length) fail("trailing data");
  return result;
}

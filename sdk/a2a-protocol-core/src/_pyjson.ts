/**
 * Faithful port of Python's `json.dumps(value, sort_keys=True)` *default* output,
 * so canonical/semantic hashes computed here are BYTE-IDENTICAL to the Python
 * `a2a-protocol-core` reference implementation.
 *
 * The two non-obvious things this preserves vs. the native `JSON.stringify`:
 *   1. Separators carry spaces: items joined by ", " and keys by ": "
 *      (Python's default when `indent` is None).
 *   2. `ensure_ascii=True`: every non-ASCII code point is escaped as \uXXXX
 *      (surrogate pairs for astral chars), exactly as CPython does.
 *
 * Keys are sorted. For the protocol's field names (all ASCII) JS's default
 * code-unit sort equals Python's code-point sort.
 *
 * Caveat — numbers: JS cannot distinguish `2.0` from `2`, so a JSON float with a
 * trailing zero (`2.0`) serializes as `2` here but `2.0` in Python. The protocol
 * recommends passing amounts as STRINGS; the shared test vectors stay in the
 * proven-identical zone (strings + integers + non-trailing-zero floats).
 */

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
    else if (code < 0x20) out += "\\u" + code.toString(16).padStart(4, "0");
    else if (code < 0x80) out += ch;
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

function dump(value: unknown): string {
  if (value === null || value === undefined) return "null";
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      return String(value); // see numbers caveat above
    case "string":
      return escapeString(value);
    case "object": {
      if (Array.isArray(value)) {
        return "[" + value.map(dump).join(", ") + "]";
      }
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj).sort();
      return "{" + keys.map((k) => escapeString(k) + ": " + dump(obj[k])).join(", ") + "}";
    }
    default:
      throw new Error(`pyJsonDumps: cannot serialize ${typeof value}`);
  }
}

/** Serialize like Python `json.dumps(value, sort_keys=True)` (default separators, ensure_ascii). */
export function pyJsonDumps(value: unknown): string {
  return dump(value);
}

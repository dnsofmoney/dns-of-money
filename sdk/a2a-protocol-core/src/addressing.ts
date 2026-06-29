/**
 * FAS-1 `pay:` URI addressing — TS mirror of the Python `addressing` module.
 *
 * The single source of truth for the `pay:` address grammar across the A2A
 * surface. Dependency-free.
 */

// pay:<label>(.<label>)* — labels are lowercase alphanumeric + hyphen, 1..63
// chars, no leading hyphen. Total length capped at 128.
export const PAY_URI_PATTERN = /^pay:[a-z0-9][a-z0-9-]{0,62}(\.[a-z0-9][a-z0-9-]{0,62})*$/;

export const MAX_PAY_URI_LENGTH = 128;

/** Return true if `value` is a syntactically valid `pay:` URI. */
export function isValidPayUri(value: string): boolean {
  return PAY_URI_PATTERN.test(value) && value.length <= MAX_PAY_URI_LENGTH;
}

/** Return `value` if valid, else throw. */
export function assertValidPayUri(value: string): string {
  if (!isValidPayUri(value)) {
    throw new Error(`Invalid pay: URI format: ${value}`);
  }
  return value;
}

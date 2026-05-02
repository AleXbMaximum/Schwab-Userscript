/**
 * Tiny className join utility — drops falsy values and joins with spaces.
 * Mirrors AlexQuant's UI/lib/styles/runtime.ts cx().
 */
export function cx(
  ...args: Array<string | false | null | undefined>
): string {
  let out = "";
  for (const a of args) {
    if (!a) continue;
    if (out.length > 0) out += " ";
    out += a;
  }
  return out;
}

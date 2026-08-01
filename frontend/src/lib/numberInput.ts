// Native `type="number"` inputs silently blank out on several intermediate keystrokes
// (typing "-", or certain decimal states) and allow currency-irrelevant characters like
// "e". Sanitizing a plain text input by hand gives predictable, currency-appropriate typing.
export function sanitizeAmountInput(raw: string): string {
  let value = raw.replace(/[^0-9.-]/g, "");

  const negative = value.startsWith("-");
  value = value.replace(/-/g, "");
  if (negative) value = "-" + value;

  const firstDot = value.indexOf(".");
  if (firstDot !== -1) {
    value = value.slice(0, firstDot + 1) + value.slice(firstDot + 1).replace(/\./g, "");
    const decimals = value.slice(firstDot + 1);
    if (decimals.length > 2) value = value.slice(0, firstDot + 3);
  }

  return value;
}

/**
 * Format a number to 2 significant figures.
 * Returns a string suitable for display.
 *
 *   sig2(25.3)   → "25"
 *   sig2(1.4)    → "1.4"
 *   sig2(0.35)   → "0.35"
 *   sig2(9.3)    → "9.3"
 *   sig2(0)      → "0"
 *   sig2(100)    → "100"
 */
export default function sig2(n) {
  if (n == null || isNaN(n)) return '0'
  const num = Number(n)
  if (num === 0) return '0'
  return String(parseFloat(num.toPrecision(2)))
}

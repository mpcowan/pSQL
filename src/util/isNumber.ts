export default function isNumber(n: unknown): boolean {
  return typeof n === 'number' && !Number.isNaN(n) && Number.isFinite(n);
}

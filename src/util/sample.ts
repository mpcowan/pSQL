const clip = (n: number, min: number, max: number): number => Math.max(min, Math.min(n, max));
const getRandomInt = (minIn: number, maxEx: number): number =>
  Math.floor(minIn + Math.random() * (maxEx - minIn));

// https://en.wikipedia.org/wiki/Fisher–Yates_shuffle ("The modern algorithm")
export default function sample<T>(arr: T[], n = 1): T[] {
  const N = arr.length;
  // eslint-disable-next-line no-param-reassign
  n = clip(n, 0, N);
  const out = [...arr];
  for (let i = 0; i < n; i += 1) {
    const j = getRandomInt(i, N);
    const tmp = out[j];
    out[j] = out[i];
    out[i] = tmp;
  }
  return out.slice(0, n);
}

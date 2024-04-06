import assert from 'node:assert/strict';

export default function groupBy<T>(
  items: T[],
  keyOrFx: string | ((item: T, index: number) => string | string[])
): { [key: string]: T[] } {
  assert(Array.isArray(items), 'items must be an array');
  const grouped = {};
  items.forEach((item, i) => {
    let key;
    if (typeof keyOrFx === 'function') {
      key = keyOrFx(item, i);
    } else {
      key = item[keyOrFx];
    }
    assert(key != null);
    if (Array.isArray(key)) {
      key.forEach((k) => {
        if (k in grouped) {
          grouped[k].push(item);
        } else {
          grouped[k] = [item];
        }
      });
    } else if (key in grouped) {
      grouped[key].push(item);
    } else {
      grouped[key] = [item];
    }
  });
  return grouped;
}

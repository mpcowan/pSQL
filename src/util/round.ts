import assert from 'node:assert';

export default function round(num: number, decimalPlaces = 3): number {
  assert(typeof num === 'number');
  return Number(num.toFixed(decimalPlaces));
}

export function avgDecimalPlaces(nums: number[]): number {
  if (nums == null || nums.length === 0) {
    return 0;
  }

  return Math.round(
    nums.reduce((acc, n) => {
      if (Number.isInteger(n)) {
        return acc;
      }
      return acc + `${n}`.split('.')[1].length;
    }, 0) / nums.length
  );
}

export function maxDecimalPlaces(nums: number[]): number {
  if (nums == null || nums.length === 0) {
    return 0;
  }
  return Math.max(
    ...nums.map((n) => {
      if (Number.isInteger(n)) {
        return 0;
      }
      return `${n}`.split('.')[1].length;
    })
  );
}

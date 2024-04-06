import round from './round.ts';

export default function computeStats(nums: number[]): { mean: number; sigma: number } {
  const mean = round(nums.reduce((acc, val) => acc + val, 0) / nums.length);
  const sigma = round(
    Math.sqrt(nums.reduce((acc, val) => acc + (val - mean) ** 2, 0) / nums.length)
  );
  return { mean, sigma };
}

export function max(nums: number[]): number {
  if (nums.length === 0) {
    return null;
  }
  let largest = nums[0];
  for (let i = 1; i < nums.length; i += 1) {
    if (nums[i] > largest) {
      largest = nums[i];
    }
  }
  return largest;
}

export function min(nums: number[]): number {
  if (nums.length === 0) {
    return null;
  }
  let smallest = nums[0];
  for (let i = 1; i < nums.length; i += 1) {
    if (nums[i] < smallest) {
      smallest = nums[i];
    }
  }
  return smallest;
}

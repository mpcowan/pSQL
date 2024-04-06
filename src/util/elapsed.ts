import { performance } from 'node:perf_hooks';

export default function elapsed(start: number): number {
  return Math.ceil(performance.now() - start);
}

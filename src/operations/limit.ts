import { Dataset } from '../types/Dataset.ts';
import { LimitOp } from '../types/pSQL.ts';

export default function limit(
  dataset: Dataset,
  normalizedColumns: string[],
  op: LimitOp,
  locale: string
): { dataset: Dataset; enOp: string; warnings: string[] } {
  if (typeof op.amount !== 'number' || op.amount < 1) {
    throw new Error(`Invalid limit operation amount: ${op.amount}`);
  }
  return {
    dataset: dataset.slice(0, op.amount),
    enOp: `- truncate rows to the top ${op.amount.toLocaleString(locale)}\n`,
    warnings: [],
  };
}

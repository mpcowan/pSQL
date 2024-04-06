import { Dataset } from '../types/Dataset.ts';
import { OffsetOp } from '../types/pSQL.ts';

export default function offset(
  dataset: Dataset,
  normalizedColumns: string[],
  op: OffsetOp,
  locale: string
): { dataset: Dataset; enOp: string; warnings: string[] } {
  if (typeof op.amount !== 'number' || op.amount < 1) {
    throw new Error(`Invalid offset operation amount: ${op.amount}`);
  }
  return {
    dataset: dataset.slice(op.amount),
    enOp: `- skip the first ${op.amount.toLocaleString(locale)} rows\n`,
    warnings: [],
  };
}

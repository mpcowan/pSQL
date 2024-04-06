import colToIndex from './colToIndex.ts';
import { Dataset } from '../types/Dataset.ts';
import { UnwindArrayOp } from '../types/pSQL.ts';

// inspired by: https://www.mongodb.com/docs/manual/reference/operator/aggregation/unwind/#-unwind--aggregation-
// here we copy the default behavior of preserveNullAndEmptyArrays: false
// which means: if path is null, missing, or an empty array, $unwind does not output a document.

export default function unwindArray(
  dataset: Dataset,
  normalizedColumns: string[],
  op: UnwindArrayOp
): { dataset: Dataset; enOp: string; warnings: string[] } {
  const colIndex = colToIndex(op.column, normalizedColumns);
  if (colIndex === -1) {
    throw new Error(`Unable to find specified column to unwind array: "${op.column}"`);
  }

  return {
    dataset: dataset.flatMap((row) => {
      const value = row[colIndex];
      if (value == null) {
        return [];
      }
      if (Array.isArray(value)) {
        return value.map((item) => [...row.slice(0, colIndex), item, ...row.slice(colIndex + 1)]);
      }
      return [row];
    }),
    enOp: `- make a new row for each of the values in column "${op.column}"\n`,
    warnings: [],
  };
}

import normalize from '../util/normalize.ts';

export default function colToIndex(column: unknown, normalizedColumns: string[]): number {
  if (typeof column !== 'string') {
    return -1;
  }

  const exact = normalizedColumns.lastIndexOf(normalize(column));
  if (exact !== -1) {
    return exact;
  }
  // handle array subproperty access via dot-notation
  if (!column.includes('.')) {
    return -1;
  }
  const parts = column.split('.');
  const col = parts[0];
  return normalizedColumns.lastIndexOf(normalize(col));
}

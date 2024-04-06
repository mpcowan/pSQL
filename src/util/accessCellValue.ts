import { DatasetCell, DatasetRow } from '../types/Dataset.ts';
import normalize from './normalize.ts';

export function getSubpropertyChain(column: string, normalizedColumns: string[]): string[] {
  let subproperty = [];
  if (column.includes('.') && !normalizedColumns.includes(normalize(column))) {
    subproperty = column.split('.').slice(1);
  }
  return subproperty;
}

export function accessCellValueWithSubproperties(
  row: DatasetRow,
  index: number,
  subproperties: string[]
): DatasetCell {
  const v = row[index];
  if (subproperties.length === 0) {
    return v;
  }
  if (v == null) {
    return v;
  }
  if (Array.isArray(v)) {
    return v.map((subitem) => subproperties.reduce((acc, prop) => acc?.[prop], subitem));
  }
  if (typeof v === 'object') {
    return subproperties.reduce((acc, prop) => acc?.[prop], v);
  }
  return null;
}

export default function accessCellValue(row: DatasetRow, index: number, col: string): DatasetCell {
  const v = row[index];
  if (!col.includes('.') || typeof v !== 'object' || v == null) {
    return v;
  }

  // subproperty access required
  const subproperty = col.split('.').slice(1);
  if (Array.isArray(v)) {
    return v.map((subitem) => subproperty.reduce((acc, prop) => acc?.[prop], subitem));
  }
  return subproperty.reduce((acc, prop) => acc?.[prop], v);
}

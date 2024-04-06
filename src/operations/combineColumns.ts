import accessCellValue from '../util/accessCellValue.ts';
import colToIndex from './colToIndex.ts';
import { CombineColumnsOp } from '../types/pSQL.ts';
import { Dataset, DatasetCell } from '../types/Dataset.ts';
import isNumber from '../util/isNumber.ts';
import { max, min } from '../util/stats.ts';
import stringToNumber from '../util/stringToNumber.ts';

export const SupportedCombinationFunctions = [
  'ADD',
  'SUB',
  'SUB_ABS',
  'MUL',
  'DIV',
  'MOD',
  'AVG',
  'MAX',
  'MIN',
  'CONCAT',
  'MEDIAN',
  'MODE',
  'STDEV',
];

const prettyCols = (cols: string[]): string => cols.map((c) => `"${c}"`).join(', ');

export default function combineColumns(
  dataset: Dataset,
  normalizedColumns: string[],
  op: CombineColumnsOp
): { dataset: Dataset; enOp: string; newColumns: string[]; warnings: string[] } {
  if (!SupportedCombinationFunctions.includes(op.function)) {
    throw new Error(`Unsupported column combination function: ${op.function}`);
  }

  if (op.columns.length < 2) {
    throw new Error(`Combining columns requires two or more columns. Only provided: ${op.columns}`);
  }

  if (new Set(op.columns).size !== op.columns.length) {
    throw new Error(
      `All columns provided to combine columns must be unique. Provided: ${prettyCols(
        op.columns
      )}. Perhaps use the mapColumns operation first?`
    );
  }

  const warnings = [];
  const missingCols = [];
  const colIndices = op.columns.map((c) => {
    const colIndex = colToIndex(c, normalizedColumns);
    if (colIndex === -1) {
      missingCols.push(c);
    }
    return colIndex;
  });
  if (missingCols.length > 0) {
    throw new Error(
      `Unable to find specified columns for column combination: ${prettyCols(missingCols)}`
    );
  }

  const newCol: DatasetCell[] = dataset.map((row) => {
    if (op.function === 'CONCAT') {
      return colIndices
        .map((colIndex, i) => accessCellValue(row, colIndex, op.columns[i]))
        .join('');
    }

    const values = colIndices
      .map((colIndex, i) => stringToNumber(accessCellValue(row, colIndex, op.columns[i])))
      .filter((v) => isNumber(v));
    if (values.length === 0) {
      return null;
    }

    switch (op.function) {
      case 'ADD':
        return values.reduce((accum, value) => accum + value, 0);
      case 'SUB':
        return values.slice(1).reduce((accum, value) => accum - value, values[0]);
      case 'SUB_ABS':
        return Math.abs(values.slice(1).reduce((accum, value) => accum - value, values[0]));
      case 'MUL':
        return values.reduce((accum, value) => accum * value, 1);
      case 'DIV': {
        // be careful to avoid divide by 0
        if (values.slice(1).some((v) => v === 0)) {
          return null;
        }
        return values.slice(1).reduce((accum, value) => accum / value, values[0]);
      }
      case 'MOD': {
        // be careful to avoid divide by 0
        if (values.slice(1).some((v) => v === 0)) {
          return null;
        }
        return values.slice(1).reduce((accum, value) => accum % value, values[0]);
      }
      case 'AVG':
        return values.reduce((accum, value) => accum + value, 0) / values.length;
      case 'MAX':
        return max(values);
      case 'MIN':
        return min(values);
      case 'MEDIAN': {
        const sorted = values.sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      }
      case 'MODE': {
        const counts = values.reduce((accum, value) => {
          accum[value] = (accum[value] || 0) + 1;
          return accum;
        }, {} as { [key: number]: number });
        let maxOccurences = 0;
        let mode;
        Object.entries(counts).forEach(([val, count]) => {
          if (count > maxOccurences) {
            maxOccurences = count;
            mode = val;
          }
        });
        return mode;
      }
      case 'STDEV': {
        if (values.length === 1) {
          return 0;
        }
        const mean = values.reduce((accum, v) => accum + v, 0) / values.length;
        return Math.sqrt(
          values.reduce((accum, v) => accum + (v - mean) ** 2, 0) / (values.length - 1)
        );
      }
      default:
        return null;
    }
  });

  const displayValue = (value) => (typeof value === 'string' ? `"${value}"` : value);
  const listValues = (values) =>
    values.length < 2
      ? displayValue(values[0])
      : `${values.slice(0, -1).map(displayValue).join(', ')} and ${displayValue(values.at(-1))}`;

  let enOp = `- create a new column named "${op.as}" by `;
  switch (op.function) {
    case 'ADD':
      enOp += `summing ${listValues(op.columns)}\n`;
      break;
    case 'SUB':
      enOp += `subtracting ${listValues(op.columns.slice(1))} from ${displayValue(
        op.columns[0]
      )}\n`;
      break;
    case 'SUB_ABS':
      enOp += `subtracting ${listValues(op.columns.slice(1))} from ${displayValue(
        op.columns[0]
      )} and computing the absolute value\n`;
      break;
    case 'MUL':
      enOp += `multiplying ${listValues(op.columns)}\n`;
      break;
    case 'DIV':
      enOp += `dividing ${displayValue(op.columns[0])} by ${listValues(op.columns.slice(1))}\n`;
      break;
    case 'MOD':
      enOp += `dividing ${displayValue(op.columns[0])} by ${listValues(
        op.columns.slice(1)
      )} and taking the remainder\n`;
      break;
    case 'AVG':
      enOp += `averaging ${listValues(op.columns)}\n`;
      break;
    case 'MAX':
      enOp += `finding the maximum value across ${listValues(op.columns)}\n`;
      break;
    case 'MIN':
      enOp += `finding the minimum value across ${listValues(op.columns)}\n`;
      break;
    case 'CONCAT':
      enOp += `concatenating the values from ${listValues(op.columns)}\n`;
      break;
    case 'MEDIAN':
      enOp += `finding the median value across ${listValues(op.columns)}\n`;
      break;
    case 'MODE':
      enOp += `finding the mode value across ${listValues(op.columns)}\n`;
      break;
    case 'STDEV':
      enOp += `computing the standard deviation of ${listValues(op.columns)}\n`;
      break;
    default:
      enOp += `applying the ${op.function} function to ${listValues(op.columns)}\n`;
  }

  return {
    dataset: dataset.map((row, i) => [...row, newCol[i]]),
    enOp,
    newColumns: [op.as],
    warnings,
  };
}

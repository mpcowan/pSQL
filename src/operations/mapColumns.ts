import accessCellValue from '../util/accessCellValue.ts';
import colToIndex from './colToIndex.ts';
import { Dataset, DatasetCell, DatasetRow } from '../types/Dataset.ts';
import { MapColumnOp } from '../types/pSQL.ts';
import { max, min } from '../util/stats.ts';
import round from '../util/round.ts';
import stringToNumber from '../util/stringToNumber.ts';

function isSupportedMapFunction(name: string): boolean {
  return [
    'LEN',
    'ABS',
    'ROUND',
    'CEIL',
    'FLOOR',
    'UCASE',
    'LCASE',
    'POW',
    'SQRT',
    'ADD',
    'SUB',
    'DIV',
    'MUL',
    'MOD',
    'COALESCE',
    // array functions
    'AVG',
    'SUM',
    'MIN',
    'MAX',
    'MEDIAN',
    'STDEV',
    'VARIANCE',
  ].includes(name);
}

export function friendlyMapFunctionText(op: MapColumnOp): string {
  const prefix = op.as
    ? `- create a new column named "${op.as}" by`
    : `- overwrite the "${op.column}" column by`;
  const postfix = op.as ? `the values in "${op.column}"` : 'each value';

  switch (op.function) {
    case 'LEN':
      return `${prefix} counting the length of ${postfix}\n`;
    case 'ABS':
      return `${prefix} taking the absolute value of ${postfix}\n`;
    case 'ROUND':
      return `${prefix} rounding ${postfix} to ${op.functionArg ?? 0} decimal place${
        op.functionArg !== 1 ? 's' : ''
      }\n`;
    case 'CEIL':
      return `${prefix} rounding ${postfix} up to the nearest whole number\n`;
    case 'FLOOR':
      return `${prefix} rounding ${postfix} down to the nearest whole number\n`;
    case 'UCASE':
      return `${prefix} converting ${postfix} to uppercase\n`;
    case 'LCASE':
      return `${prefix} converting ${postfix} to lowercase\n`;
    case 'POW':
      return `${prefix} raising ${postfix} to the power of ${op.functionArg}\n`;
    case 'SQRT':
      return `${prefix} taking the square root of ${postfix}\n`;
    case 'ADD':
      return `${prefix} adding ${op.functionArg} to ${postfix}\n`;
    case 'SUB':
      return `${prefix} subtracting ${op.functionArg} from ${postfix}\n`;
    case 'DIV':
      return `${prefix} dividing ${postfix} by ${op.functionArg}\n`;
    case 'MUL':
      return `${prefix} multiplying ${postfix} by ${op.functionArg}\n`;
    case 'MOD':
      return `${prefix} computing the remainder of ${postfix} divided by ${op.functionArg}\n`;
    case 'COALESCE':
      return `${prefix} replacing null values in ${postfix} with "${op.functionArg}"\n`;
    case 'AVG':
      return `${prefix} computing the average of ${postfix}\n`;
    case 'SUM':
      return `${prefix} computing the sum of ${postfix}\n`;
    case 'MIN':
      return `${prefix} finding the minimum value of ${postfix}\n`;
    case 'MAX':
      return `${prefix} finding the maximum value of ${postfix}\n`;
    case 'MEDIAN':
      return `${prefix} finding the median value of ${postfix}\n`;
    case 'STDEV':
      return `${prefix} computing the standard deviation of ${postfix}\n`;
    case 'VARIANCE':
      return `${prefix} computing the variance of ${postfix}\n`;
    default:
      return `${prefix} executing the ${op.function}(${
        op.functionArg ?? ''
      }) function on ${postfix}\n`;
  }
}

const numericArgFns = ['POW', 'ADD', 'SUB', 'DIV', 'MUL', 'MOD'];

export default function mapColumn(
  dataset: Dataset,
  normalizedColumns: string[],
  op: MapColumnOp
): { dataset: Dataset; enOp: string; newColumns: string[]; warnings: string[] } {
  const colIndex = colToIndex(op.column, normalizedColumns);
  const warningsSet = new Set<string>();

  if (colIndex === -1) {
    throw new Error(
      `Unable to find specified column for ${op.function} operation on column "${op.column}"`
    );
  }

  if (!isSupportedMapFunction(op.function)) {
    if (/format/i.test(op.function)) {
      throw new Error(
        `Unsupported map function ${op.function} on column "${op.column}". If you are trying to format a date, use the formatDates operation instead.`
      );
    }
    throw new Error(`Unsupported map function ${op.function} on column "${op.column}"`);
  }

  // asking for a function that requires a functionArg but didn't provide one?
  let getArg = (row: DatasetRow): DatasetCell => op.functionArg;
  if (numericArgFns.includes(op.function) && (op.functionArg == null || op.functionArg === '')) {
    throw new Error(
      `Missing function argument for ${op.function} operation on column "${op.column}"`
    );
  }
  if (numericArgFns.includes(op.function) && typeof op.functionArg !== 'number') {
    // is op.functionArg a reference to a column?
    const argColIndex = colToIndex(op.functionArg, normalizedColumns);
    if (argColIndex !== -1) {
      getArg = (row: DatasetRow) => accessCellValue(row, argColIndex, op.functionArg as string);
    } else {
      throw new Error(
        `Invalid function argument provided for ${op.function} operation on column "${op.column}". Expected a number literal, but got "${op.functionArg}".`
      );
    }
  }

  if (['COALESCE'].includes(op.function) && op.functionArg == null) {
    throw new Error(
      `Missing function argument for ${op.function} operation on column "${op.column}"`
    );
  }

  const newVals = dataset.map((row) => {
    const cellVal = accessCellValue(row, colIndex, op.column);
    if (op.function === 'COALESCE') {
      return cellVal == null ? op.functionArg : cellVal;
    }
    if (cellVal == null) {
      return null;
    }
    const isArray = Array.isArray(cellVal);
    // handle string functions first
    switch (op.function) {
      case 'LEN':
        if (isArray) {
          return cellVal.length;
        }
        return [...new Intl.Segmenter().segment(`${cellVal}`)].length;
      case 'UCASE':
        if (isArray) {
          if (cellVal.every((v) => typeof v === 'string')) {
            return cellVal.map((v: string) => v.toUpperCase());
          }
          warningsSet.add(
            `Unable to convert non-string array values in column "${op.column}" to uppercase`
          );
          return cellVal;
        }
        return `${cellVal}`.toUpperCase();
      case 'LCASE':
        if (isArray) {
          if (cellVal.every((v) => typeof v === 'string')) {
            return cellVal.map((v: string) => v.toUpperCase());
          }
          warningsSet.add(
            `Unable to convert non-string array values in column "${op.column}" to lowercase`
          );
          return cellVal;
        }
        return `${cellVal}`.toLowerCase();
      default:
        break;
    }

    if (!isArray) {
      // convert to number to handle numeric functions
      const cellValNum = stringToNumber(cellVal);
      if (cellValNum == null) {
        warningsSet.add(`Unable to convert some values to number for ${op.function} operation`);
        return null;
      }
      if (numericArgFns.includes(op.function)) {
        const arg = stringToNumber(getArg(row));
        if (typeof arg !== 'number') {
          // TODO should this produce a warning?
          return null;
        }
        switch (op.function) {
          case 'POW':
            return cellValNum ** arg;
          case 'ADD':
            return cellValNum + arg;
          case 'SUB':
            return cellValNum - arg;
          case 'DIV':
            return arg === 0 ? null : cellValNum / arg;
          case 'MUL':
            return cellValNum * arg;
          case 'MOD':
            return arg === 0 ? null : cellValNum % arg;
          default:
            break;
        }
      }
      switch (op.function) {
        case 'ABS':
          return Math.abs(cellValNum);
        case 'CEIL':
          return Math.ceil(cellValNum);
        case 'FLOOR':
          return Math.floor(cellValNum);
        case 'ROUND':
          return round(cellValNum, typeof op.functionArg === 'number' ? op.functionArg : 0);
        case 'SQRT':
          return Math.sqrt(cellValNum);
        default:
          throw new Error(
            `Unsupported mapColumn function for scalar values: ${op.function} on column "${op.column}". Perhaps use an aggregation.`
          );
      }
    } else if (cellVal.every((v) => typeof v === 'number')) {
      const nums = cellVal as number[];
      // mapping over a numeric array column
      if (numericArgFns.includes(op.function)) {
        const arg = stringToNumber(getArg(row));
        if (typeof arg !== 'number') {
          // TODO should this produce a warning?
          return null;
        }
        switch (op.function) {
          case 'POW':
            return nums.map((n) => n ** arg);
          case 'ADD':
            return nums.map((n) => n + arg);
          case 'SUB':
            return nums.map((n) => n - arg);
          case 'DIV':
            return arg === 0 ? null : nums.map((n) => n / arg);
          case 'MUL':
            return nums.map((n) => n * arg);
          case 'MOD':
            return arg === 0 ? null : nums.map((n) => n % arg);
          default:
            break;
        }
      }
      switch (op.function) {
        case 'ABS':
          return nums.map((n) => Math.abs(n));
        case 'CEIL':
          return nums.map((n) => Math.ceil(n));
        case 'FLOOR':
          return nums.map((n) => Math.floor(n));
        case 'ROUND':
          return nums.map((n) => round(n, typeof op.functionArg === 'number' ? op.functionArg : 0));
        case 'SQRT':
          return nums.map((n) => Math.sqrt(n));
        // numeric arrays support additional functions
        case 'AVG':
          return nums.length === 0 ? null : nums.reduce((acc, n) => acc + n, 0) / nums.length;
        case 'SUM':
          return nums.length === 0 ? null : nums.reduce((acc, n) => acc + n, 0);
        case 'MIN':
          return nums.length === 0 ? null : min(nums);
        case 'MAX':
          return nums.length === 0 ? null : max(nums);
        case 'MEDIAN': {
          if (nums.length === 0) {
            return null;
          }
          const sorted = [...nums].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        }
        case 'STDEV':
        case 'VARIANCE': {
          if (nums.length === 0) {
            return null;
          }
          if (nums.length === 1) {
            return 0;
          }
          const mean = nums.reduce((acc, n) => acc + n, 0) / nums.length;
          return Math.sqrt(
            nums.reduce((acc, v) => acc + (v - mean) ** 2, 0) /
              (nums.length - (op.function === 'STDEV' ? 1 : 0))
          );
        }
        default:
          throw new Error(
            `Unsupported mapColumn function for array values: ${op.function} on column "${op.column}"`
          );
      }
    } else {
      throw new Error(
        `Unable to perform mapColumn function "${op.function}" on array column of non-numeric values in column "${op.column}"`
      );
    }
  });

  return {
    dataset: dataset.map((row, i) => {
      if (op.as) {
        // create new column
        return [...row, newVals[i]];
      }
      // overwrite existing column
      const r = [...row];
      r[colIndex] = newVals[i];
      return r;
    }),
    enOp: friendlyMapFunctionText(op),
    newColumns: [op.as],
    warnings: [...warningsSet],
  };
}

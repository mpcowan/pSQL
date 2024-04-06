import { DateTime } from 'luxon';

import accessCellValue from '../util/accessCellValue.ts';
import colToIndex from './colToIndex.ts';
import { Comparison, FilterCondition, FilterOp } from '../types/pSQL.ts';
import { Dataset, DatasetCell, DatasetRow } from '../types/Dataset.ts';
import normalize from '../util/normalize.ts';
import stringToDate from '../util/stringToDate.ts';
import stringToNumber from '../util/stringToNumber.ts';

interface NormalizedComparison extends Comparison {
  colIndex: number;
  compareToValue?: number | string | boolean;
  compareToColIndex?: number;
}

interface NormalizedAndComparison {
  and: (NormalizedComparison | NormalizedAndComparison | NormalizedOrComparison)[];
}

interface NormalizedOrComparison {
  or: (NormalizedComparison | NormalizedAndComparison | NormalizedOrComparison)[];
}

type NormalizedFilterCondition =
  | NormalizedComparison
  | NormalizedAndComparison
  | NormalizedOrComparison;

export const SupportedComparisonOperators = [
  '==',
  '!=',
  '<',
  '<=',
  '>',
  '>=',
  'startsWith',
  'endsWith',
  'contains',
  'isNull',
  'isNotNull',
];

const stringOperators = ['contains', 'startsWith', 'endsWith'];

const rowSatisfiesCondition = (
  condition: NormalizedFilterCondition,
  row: DatasetRow,
  log
): boolean => {
  // recursive conditions
  if ('and' in condition) {
    return condition.and.every((c) => rowSatisfiesCondition(c, row, log));
  }
  if ('or' in condition) {
    return condition.or.some((c) => rowSatisfiesCondition(c, row, log));
  }
  // root condition
  const { dataType, colIndex, operator, compareToValue, compareToColIndex } = condition;
  const cell = accessCellValue(row, colIndex, condition.column);

  if (['isNull', 'isNotNull'].includes(operator)) {
    const isNullish =
      cell == null ||
      (Array.isArray(cell) && cell.length === 0) ||
      (typeof cell === 'string' && cell.trim() === '') ||
      (dataType === 'number' && typeof cell === 'string' && !/\d/.test(cell));
    if (operator === 'isNull') {
      return condition.not ? !isNullish : isNullish;
    }
    return condition.not ? isNullish : !isNullish;
  }
  // at this point a null cell will never satisfy any remaining conditions
  if (cell == null) {
    return false;
  }

  const parse = (v: DatasetCell, dateFormat?: string): DatasetCell | DateTime => {
    if (stringOperators.includes(operator)) {
      return Array.isArray(v) ? v.map((i) => normalize(`${i}`)) : normalize(`${v}`);
    }
    switch (dataType) {
      case 'number':
        return Array.isArray(v) ? v.map(stringToNumber) : stringToNumber(v);
      case 'date':
        return Array.isArray(v)
          ? v.map((i) => stringToDate(i, dateFormat))
          : stringToDate(v, dateFormat);
      default:
        return Array.isArray(v) ? v.map((i) => normalize(`${i}`)) : normalize(`${v}`);
    }
  };

  const parsedCell: string | number | DateTime = parse(
    cell,
    condition.columnDateFormat || condition.compareToDateFormat
  );

  if (parsedCell == null) {
    return false;
  }

  const parsedValue: string | number | DateTime =
    compareToColIndex != null
      ? parse(
          accessCellValue(row, compareToColIndex, condition.compareTo as string),
          condition.compareToDateFormat || condition.columnDateFormat
        )
      : parse(compareToValue, condition.compareToDateFormat || condition.columnDateFormat);

  if (parsedValue == null && compareToValue != null && ['date', 'number'].includes(dataType)) {
    log.error({ dataType }, 'LLM provided value was not able to be parsed to its expected type');
    return true;
  }

  let result;

  if (Array.isArray(parsedCell)) {
    switch (operator) {
      case '==':
        if (parsedValue === '[]') {
          return parsedCell.length === 0;
        }
        result = parsedCell.includes(parsedValue);
        break;
      case '!=':
        if (parsedValue === '[]') {
          return parsedCell.length !== 0;
        }
        result = !parsedCell.includes(parsedValue);
        break;
      case 'contains':
        result = parsedCell.some((i) => `${i}`.includes(parsedValue as string));
        break;
      case 'startsWith':
        result = parsedCell.some((i) => `${i}`.startsWith(parsedValue as string));
        break;
      case 'endsWith':
        result = parsedCell.some((i) => `${i}`.endsWith(parsedValue as string));
        break;
      default:
        log.error({ operator }, 'Unsupported array filter operator');
        return true;
    }
    return condition.not ? !result : result;
  }

  switch (operator) {
    case '==': {
      if (dataType === 'date') {
        result = parsedValue?.valueOf() === parsedCell.valueOf();
      } else {
        result = parsedCell === parsedValue;
      }
      break;
    }
    case '!=': {
      if (dataType === 'date') {
        result = parsedValue?.valueOf() !== parsedCell.valueOf();
      } else {
        result = parsedCell !== parsedValue;
      }
      break;
    }
    case '>':
      result = parsedCell > parsedValue;
      break;
    case '>=':
      result = parsedCell >= parsedValue;
      break;
    case '<':
      result = parsedCell < parsedValue;
      break;
    case '<=':
      result = parsedCell <= parsedValue;
      break;
    case 'contains':
      result = (parsedCell as string).includes(parsedValue as string);
      break;
    case 'startsWith':
      result = (parsedCell as string).startsWith(parsedValue as string);
      break;
    case 'endsWith':
      result = (parsedCell as string).endsWith(parsedValue as string);
      break;
    default:
      log.error({ operator }, 'Unknown filter operator');
      return true;
  }
  return condition.not ? !result : result;
};

const isValidComparison = (
  comparison: Comparison,
  normalizedColumns: string[],
  log
): string | null => {
  const { column, operator, compareTo, dataType } = comparison;
  if (colToIndex(column, normalizedColumns) === -1) {
    return `Unable to find specified filter condition column: "${column}"`;
  }
  if (!SupportedComparisonOperators.includes(operator)) {
    return `Unsupported filter operator: ${operator}`;
  }
  if (!['isNull', 'isNotNull'].includes(operator) && compareTo == null) {
    return `Missing required comparison value for filter operation on: "${column}"`;
  }
  if (typeof compareTo === 'string' && ['>', '<', '<=', '>='].includes(operator)) {
    // is this a column or a parseable value?
    if (colToIndex(compareTo, normalizedColumns) !== -1) {
      // column
      return null;
    }
    if (dataType === 'string') {
      return null;
    }
    if (dataType === 'number') {
      if (stringToNumber(compareTo) != null) {
        // parseable number
        return null;
      }
      return `Unable to parse number "${compareTo}" for filtering on column "${column}"`;
    }
    if (dataType === 'date') {
      if (
        stringToDate(compareTo, comparison.compareToDateFormat || comparison.columnDateFormat) !=
        null
      ) {
        // parseable date
        return null;
      }
      return `Unable to parse date "${compareTo}" for filtering on column "${column}". Try specifying a compareToDateFormat.`;
    }
    if (dataType == null) {
      // can we guess the type?
      if (comparison.columnDateFormat || comparison.compareToDateFormat) {
        // assume its a date
        const parsed = stringToDate(
          compareTo,
          comparison.compareToDateFormat || comparison.columnDateFormat
        );
        return parsed != null
          ? null
          : `Unable to parse date "${compareTo}" for filtering on column "${column}". Try specifying a dataType.`;
      }
      // assume its a number
      const parsed = stringToNumber(compareTo);
      return parsed != null
        ? null
        : `Unable to parse number "${compareTo}" for filtering on column "${column}". Try specifying a dataType.`;
    }
    log.error({ comparison }, 'Invalid comparison');
    return `Unable to parse comparison value "${compareTo}" for filtering on column "${column}"`;
  }
  return null;
};

const isValidCondition = (
  condition: FilterCondition,
  normalizedColumns: string[],
  log
): string[] => {
  if ('and' in condition) {
    return condition.and.flatMap((c) => isValidCondition(c, normalizedColumns, log));
  }
  if ('or' in condition) {
    return condition.or.flatMap((c) => isValidCondition(c, normalizedColumns, log));
  }

  const validComparison = isValidComparison(condition, normalizedColumns, log);
  return validComparison == null ? [] : [validComparison];
};

const normalizeCondition = (
  condition: FilterCondition,
  normalizedColumns: string[]
): NormalizedFilterCondition => {
  if ('and' in condition) {
    return {
      and: condition.and.map((c) => normalizeCondition(c, normalizedColumns)),
    };
  }
  if ('or' in condition) {
    return {
      or: condition.or.map((c) => normalizeCondition(c, normalizedColumns)),
    };
  }
  if ('column' in condition) {
    const colIndex = colToIndex(condition.column, normalizedColumns);
    if (typeof condition.compareTo === 'number') {
      return {
        ...condition,
        colIndex,
        compareToValue: condition.compareTo,
        dataType: condition.dataType || 'number',
      };
    }
    if (['isNull', 'isNotNull'].includes(condition.operator)) {
      return {
        ...condition,
        colIndex,
      };
    }
    let { dataType } = condition;
    if (dataType == null) {
      // try to guess it
      if (condition.columnDateFormat || condition.compareToDateFormat) {
        dataType = 'date';
      } else if (['>', '<', '>=', '<='].includes(condition.operator)) {
        dataType = 'number';
      } else if (stringOperators.includes(condition.operator)) {
        dataType = 'string';
      }
    }
    // determine if we are comparing to a column or a value
    if (colToIndex(condition.compareTo, normalizedColumns) !== -1) {
      return {
        ...condition,
        colIndex,
        compareToColIndex: colToIndex(condition.compareTo, normalizedColumns),
        dataType,
      };
    }

    return {
      ...condition,
      colIndex: colToIndex(condition.column, normalizedColumns),
      compareToValue: condition.compareTo,
      dataType,
    };
  }
  throw new Error('Unable to normalize filter condition');
};

const conditionToFriendlyString = (condition: NormalizedFilterCondition, depth: number): string => {
  const leadingWhitespace = ' '.repeat(depth * 2);
  if ('and' in condition) {
    return `${leadingWhitespace}- matches all of:\n${condition.and
      .map((c) => conditionToFriendlyString(c, depth + 1))
      .join('\n')}`;
  }
  if ('or' in condition) {
    return `${leadingWhitespace}- matches any of:\n${condition.or
      .map((c) => conditionToFriendlyString(c, depth + 1))
      .join('\n')}`;
  }

  const { column, operator, compareTo, compareToColIndex, not } = condition;
  if (operator === 'isNull') {
    return `${leadingWhitespace}- "${column}" is ${not ? 'not ' : ''}null`;
  }
  if (operator === 'isNotNull') {
    return `${leadingWhitespace}- "${column}" is ${not ? '' : 'not '}null`;
  }
  if (compareToColIndex != null) {
    return `${leadingWhitespace}- "${column}" ${
      not ? 'not ' : ''
    }${operator} the "${compareTo}" column`;
  }
  return `${leadingWhitespace}- "${column}" ${not ? 'not ' : ''}${operator} ${compareTo}`;
};

const fixCondition = (condition: FilterCondition): FilterCondition => {
  // For not conditions sometimes the LLM drops a ! in front of the operator
  if ('and' in condition) {
    return {
      and: condition.and.map((c) => fixCondition(c)),
    };
  }
  if ('or' in condition) {
    return {
      or: condition.or.map((c) => fixCondition(c)),
    };
  }

  if (
    condition.operator?.startsWith('!') &&
    ['startsWith', 'endsWith', 'contains', 'isNull'].includes(condition.operator.slice(1))
  ) {
    return {
      ...condition,
      operator: condition.operator.slice(1) as 'startsWith' | 'endsWith' | 'contains' | 'isNull',
      not: true,
    };
  }

  // convert == null and != null to isNull
  if (condition.compareTo === null && ['==', '!='].includes(condition.operator)) {
    return {
      ...condition,
      operator: 'isNull',
      not: condition.operator === '!=',
    };
  }

  return condition;
};

export default function filter(
  dataset: Dataset,
  normalizedColumns: string[],
  op: FilterOp,
  locale: string,
  log
): { dataset: Dataset; enOp: string; warnings: string[] } {
  // The LLM might put or | and at the top level instead of inside the condition
  // we could probably recover that automatically but for now we error
  if (op.condition == null) {
    throw new Error(
      `Unable to parse provided filter condition due to lacking top level condition key`
    );
  }

  const fixedCondition = fixCondition(op.condition);

  const validityWarnings = isValidCondition(fixedCondition, normalizedColumns, log);
  if (validityWarnings.length > 0) {
    throw new Error(
      `Unable to parse provided filter condition: ${JSON.stringify(
        op.condition
      )}\n\nErrors:\n${validityWarnings.join('\n')}`
    );
  }

  // before we process the rows we need to get the column indexes and parse the comparison values
  const normalizedCondition = normalizeCondition(fixedCondition, normalizedColumns);
  const filtered = dataset.filter((row) => rowSatisfiesCondition(normalizedCondition, row, log));

  return {
    dataset: filtered,
    enOp: `- filter rows to those that satisfy the following conditions:\n${conditionToFriendlyString(
      normalizedCondition,
      1
    )}\n`,
    warnings: [],
  };
}

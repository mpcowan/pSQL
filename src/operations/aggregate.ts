import { accessCellValueWithSubproperties, getSubpropertyChain } from '../util/accessCellValue.ts';
import { Aggregation } from '../types/pSQL.ts';
import colToIndex from './colToIndex.ts';
import { Dataset, DatasetRow } from '../types/Dataset.ts';
import isNumber from '../util/isNumber.ts';
import { max, min } from '../util/stats.ts';
import stringToNumber from '../util/stringToNumber.ts';

export const SupportedAggregationFunctions = [
  'COUNT',
  'COUNT_DISTINCT',
  'AVG',
  'MIN',
  'MAX',
  'SUM',
  'MEDIAN',
  'STDEV',
  'VARIANCE',
  'RANGE',
  'FIRST',
  'LAST',
];

export function friendlyFunctionText(f: string): string {
  switch (f) {
    case 'COUNT':
      return 'counting the number';
    case 'COUNT_DISTINCT':
      return 'counting the number of distinct';
    case 'AVG':
      return 'computing the average';
    case 'MIN':
      return 'finding the minimum';
    case 'MAX':
      return 'finding the maximum';
    case 'SUM':
      return 'computing the sum';
    case 'MEDIAN':
      return 'finding the median';
    case 'STDEV':
      return 'computing the standard deviation';
    case 'VARIANCE':
      return 'computing the variance';
    case 'RANGE':
      return 'determining the range (the difference between the max and min values)';
    case 'FIRST':
      return 'taking the first value';
    case 'LAST':
      return 'taking the last value';
    default:
      return f;
  }
}

export default function aggregate(
  rowGroup: Dataset,
  normalizedColumns: string[],
  aggregations: Aggregation[],
  log
): DatasetRow {
  // creates a column per aggregation
  return aggregations.map((agg) => {
    const aggColIndex = colToIndex(agg.column, normalizedColumns);
    // do we need subproperty access?
    const subproperties = getSubpropertyChain(agg.column, normalizedColumns);

    if (agg.function === 'COUNT') {
      if (!agg.column || agg.column === '*') {
        return rowGroup.length;
      }
      // return the number of rows for which column is not null
      return rowGroup.reduce((accum, row) => {
        const val = accessCellValueWithSubproperties(row, aggColIndex, subproperties);
        return accum + (val != null && val !== '' ? 1 : 0);
      }, 0);
    }
    if (agg.function === 'COUNT_DISTINCT') {
      return new Set(
        rowGroup
          .map((r) => {
            const val = accessCellValueWithSubproperties(r, aggColIndex, subproperties);
            if (val != null && val !== '') {
              return JSON.stringify(val);
            }
            return null;
          })
          .filter((v) => v != null)
      ).size;
    }
    if (agg.function === 'FIRST') {
      return accessCellValueWithSubproperties(rowGroup[0], aggColIndex, subproperties);
    }
    if (agg.function === 'LAST') {
      return accessCellValueWithSubproperties(rowGroup.at(-1), aggColIndex, subproperties);
    }

    // all remaining aggregations are numeric
    const numericValues = rowGroup
      .map((r) => stringToNumber(accessCellValueWithSubproperties(r, aggColIndex, subproperties)))
      .filter((n) => isNumber(n));

    switch (agg.function) {
      case 'AVG': {
        if (numericValues.length === 0) {
          return null;
        }
        return numericValues.reduce((acc, n) => acc + n, 0) / numericValues.length;
      }
      case 'SUM': {
        if (numericValues.length === 0) {
          return null;
        }
        return numericValues.reduce((acc, n) => acc + n, 0);
      }
      case 'MIN':
        return numericValues.length > 0 ? min(numericValues) : null;
      case 'MAX':
        return numericValues.length > 0 ? max(numericValues) : null;
      case 'RANGE':
        return numericValues.length >= 2 ? max(numericValues) - min(numericValues) : null;
      case 'MEDIAN': {
        const sortedNumbers = numericValues.sort((a, b) => a - b);
        if (sortedNumbers.length === 0) {
          return null;
        }
        if (sortedNumbers.length % 2 === 0) {
          return (
            (sortedNumbers[sortedNumbers.length / 2 - 1] +
              sortedNumbers[sortedNumbers.length / 2]) /
            2.0
          );
        }
        return sortedNumbers[Math.floor(sortedNumbers.length / 2)];
      }
      case 'STDEV':
      case 'VARIANCE': {
        if (numericValues.length === 0) {
          return null;
        }
        if (numericValues.length === 1) {
          return 0;
        }
        const mean = numericValues.reduce((acc, n) => acc + n, 0) / numericValues.length;
        return Math.sqrt(
          numericValues.reduce((acc, v) => acc + (v - mean) ** 2, 0) /
            (numericValues.length - (agg.function === 'STDEV' ? 1 : 0))
        );
      }
      default:
        log.error({ fx: agg.function }, 'Unknown aggregation function');
        return '';
    }
  });
}

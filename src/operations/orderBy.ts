import { DateTime } from 'luxon';

import accessCellValue from '../util/accessCellValue.ts';
import colToIndex from './colToIndex.ts';
import { Dataset } from '../types/Dataset.ts';
import fixDateTokens from '../util/fixDateTokens.ts';
import isNumber from '../util/isNumber.ts';
import normalize from '../util/normalize.ts';
import { OrderByOp } from '../types/pSQL.ts';
import stringToDate from '../util/stringToDate.ts';
import stringToNumber from '../util/stringToNumber.ts';

const caseInsensitiveStringCompare = (a: string, b: string, ascending: boolean): number => {
  return ascending
    ? a.localeCompare(b, undefined, { sensitivity: 'base' })
    : b.localeCompare(a, undefined, { sensitivity: 'base' });
};

export default function orderBy(
  dataset: Dataset,
  normalizedColumns: string[],
  op: OrderByOp
): { dataset: Dataset; enOp: string; warnings: string[] } {
  const { dateFormat, sortType } = op;
  const ascending = op.direction !== 'DESC';
  // figure out the target column
  const colIndex = colToIndex(op.column, normalizedColumns);
  if (colIndex === -1) {
    throw new Error(`Unable to find specified column to order by: "${op.column}"`);
  }
  // some conversions, notably string to date are expensive
  // we need to avoid doing them for every comparison and instead do them once
  const tmp: [string | number | DateTime | null, number][] = dataset.map((row, i) => {
    const val = accessCellValue(row, colIndex, op.column);
    if (val == null) {
      return [null, i];
    }
    switch (sortType) {
      case 'numeric':
        return [stringToNumber(val), i];
      case 'date': {
        const parsedDate = stringToDate(val, fixDateTokens(dateFormat));
        if (parsedDate?.isValid) {
          return [parsedDate, i];
        }
        if (isNumber(val)) {
          return [val as number, i];
        }
        if (typeof val === 'string' && /^\d+$/.test(val)) {
          return [parseInt(val, 10), i];
        }
        return [null, i];
      }
      default:
        return [normalize(`${val}`), i];
    }
  });

  tmp.sort(([a], [b]) => {
    // start by handling null values which don't care about sortType
    if (a == null && b == null) {
      return 0;
    }
    // we want values that aren't numeric to always sort to the bottom regardless of sort order
    if (a == null) {
      return 1;
    }
    if (b == null) {
      return -1;
    }

    if (sortType === 'numeric') {
      // we have pre-converted to numbers
      const aNum = a as number;
      const bNum = b as number;
      return ascending ? aNum - bNum : bNum - aNum;
    }

    if (sortType === 'date') {
      // handle unix time, this also handles excels odd days since epoch as well
      if (isNumber(a) && isNumber(b)) {
        const aNum = a as number;
        const bNum = b as number;
        return ascending ? aNum - bNum : bNum - aNum;
      }

      if (a.isValid && b.isValid) {
        // both valid DateTimes
        const aDate = a as DateTime;
        const bDate = b as DateTime;
        return ascending
          ? aDate.toMillis() - bDate.toMillis()
          : bDate.toMillis() - aDate.toMillis();
      }

      // type mismatch, one is a date and the other is a number
      // arbitrarily sort proper Dates higher than numbers
      if (a.isValid) {
        return -1;
      }
      return 1;
    }

    // we have pre-converted to normalized strings
    const aStr = a as string;
    const bStr = b as string;
    return caseInsensitiveStringCompare(aStr, bStr, ascending);
  });

  return {
    dataset: tmp.map(([, i]) => {
      return dataset[i];
    }),
    enOp: `- sort rows by "${op.column}" ${ascending ? 'ascending' : 'descending'}\n`,
    warnings: [],
  };
}

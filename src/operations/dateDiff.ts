import { DateTime } from 'luxon';

import accessCellValue from '../util/accessCellValue.ts';
import colToIndex from './colToIndex.ts';
import { Dataset } from '../types/Dataset.ts';
import { DateDiffOp } from '../types/pSQL.ts';
import fixDateTokens from '../util/fixDateTokens.ts';
import stringToDate from '../util/stringToDate.ts';

interface ParsedDateDiffOp extends DateDiffOp {
  startColIndex?: number;
  startDate?: DateTime;
  endColIndex?: number;
  endDate?: DateTime;
}

export default function dateDiff(
  dataset: Dataset,
  normalizedColumns: string[],
  op: DateDiffOp
): { dataset: Dataset; enOp: string; newColumns: string[]; warnings: string[] } {
  const parsedOp: ParsedDateDiffOp = {
    ...op,
    startDateFormat: fixDateTokens(op.startDateFormat),
    endDateFormat: fixDateTokens(op.endDateFormat),
  };

  if (colToIndex(op.startColumnOrDate, normalizedColumns) !== -1) {
    parsedOp.startColIndex = colToIndex(op.startColumnOrDate, normalizedColumns);
  } else {
    const dtA = stringToDate(op.startColumnOrDate, parsedOp.startDateFormat);
    if (dtA?.isValid) {
      parsedOp.startDate = dtA;
    } else if (/^(?:today|curdate|current_date|getdate)(?:\(\))$/i.test(op.startColumnOrDate)) {
      parsedOp.startDate = DateTime.utc().startOf('day');
    } else if (/^(?:now|current_timestamp)(?:\(\))?$/i.test(op.startColumnOrDate)) {
      parsedOp.startDate = DateTime.utc();
    }
  }
  if (colToIndex(op.endColumnOrDate, normalizedColumns) !== -1) {
    parsedOp.endColIndex = colToIndex(op.endColumnOrDate, normalizedColumns);
  } else {
    const dtB = stringToDate(op.endColumnOrDate, parsedOp.endDateFormat);
    if (dtB?.isValid) {
      parsedOp.endDate = dtB;
    } else if (/^(?:today|curdate|current_date|getdate)(?:\(\))$/i.test(op.endColumnOrDate)) {
      parsedOp.endDate = DateTime.utc().startOf('day');
    } else if (/^(?:now|current_timestamp)(?:\(\))?$/i.test(op.endColumnOrDate)) {
      parsedOp.endDate = DateTime.utc();
    }
  }

  if (!['years', 'quarters', 'months', 'weeks', 'days', 'hours', 'minutes'].includes(op.interval)) {
    throw new Error(`Unsupported interval for date difference: ${op.interval}`);
  }
  if (!parsedOp.startColIndex && !parsedOp.startDate) {
    throw new Error(
      `Unable to find or parse starting date for date difference: ${op.startColumnOrDate} (${parsedOp.startDateFormat})`
    );
  }
  if (!parsedOp.endColIndex && !parsedOp.endDate) {
    throw new Error(
      `Unable to find or parse ending date for date difference: ${op.endColumnOrDate} (${parsedOp.endDateFormat})`
    );
  }
  // at lease one of start or end must reference a column and not a literal date
  if (!parsedOp.startColIndex && !parsedOp.endColIndex) {
    throw new Error(
      `Unable to create new column with date difference between two literal dates: ${op.startColumnOrDate} and ${op.endColumnOrDate}`
    );
  }

  const newCol = dataset.map((row) => {
    let startDateTime = parsedOp.startDate;
    if (startDateTime == null) {
      const parsedA = stringToDate(
        accessCellValue(row, parsedOp.startColIndex, op.startColumnOrDate),
        parsedOp.startDateFormat
      );
      if (parsedA == null) {
        return null;
      }
      startDateTime = parsedA;
    }

    let endDateTime = parsedOp.endDate;
    if (endDateTime == null) {
      const parsedB = stringToDate(
        accessCellValue(row, parsedOp.endColIndex, op.endColumnOrDate),
        parsedOp.endDateFormat
      );
      if (parsedB == null) {
        return null;
      }
      endDateTime = parsedB;
    }
    // https://moment.github.io/luxon/#/math?id=diffs
    const diff = endDateTime.diff(startDateTime, parsedOp.interval, {
      conversionAccuracy: 'longterm',
    });
    return diff[parsedOp.interval];
  });

  const formattedStart = `${op.startColumnOrDate}${
    parsedOp.startDateFormat ? ` (${parsedOp.startDateFormat})` : ''
  }`;
  const formattedEnd = `${op.endColumnOrDate}${
    parsedOp.endDateFormat ? ` (${parsedOp.endDateFormat})` : ''
  }`;

  return {
    dataset: dataset.map((row, i) => [...row, newCol[i]]),
    enOp: `- create a new column named "${op.as}" by finding the difference in ${op.interval} between ${formattedStart} and ${formattedEnd}\n`,
    newColumns: [op.as],
    warnings: [],
  };
}

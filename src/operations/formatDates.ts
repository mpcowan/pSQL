import accessCellValue from '../util/accessCellValue.ts';
import colToIndex from './colToIndex.ts';
import { Dataset } from '../types/Dataset.ts';
import fixDateTokens from '../util/fixDateTokens.ts';
import { FormatDatesOp } from '../types/pSQL.ts';
import stringToDate from '../util/stringToDate.ts';

export default function formatDates(
  dataset: Dataset,
  normalizedColumns: string[],
  op: FormatDatesOp,
  locale: string,
  log
): { dataset: Dataset; enOp: string; newColumns: string[]; warnings: string[] } {
  const colIndex = colToIndex(op.column, normalizedColumns);
  if (colIndex === -1) {
    throw new Error(`Unable to find specified column to format dates: "${op.column}"`);
  }
  const { currentFormat, desiredFormat } = op;
  log.info({ currentFormat, desiredFormat }, 'Reformatting dates');

  // Fix common token errors
  const currentFormatFixed = fixDateTokens(currentFormat);
  const desiredFormatFixed = fixDateTokens(desiredFormat);

  if (!desiredFormatFixed) {
    throw new Error('Unable to format dates because of missing desired format');
  }

  const newCol = dataset.map((row) => {
    const target = accessCellValue(row, colIndex, op.column);
    if (target == null || typeof target !== 'string' || target.trim() === '') {
      return null;
    }
    const parsed = stringToDate(target, currentFormatFixed);
    if (parsed?.isValid) {
      return parsed.toFormat(desiredFormatFixed);
    }
    // TODO: add warning
    log.error({ target, currentFormatFixed, desiredFormatFixed }, 'Invalid date parse');
    return null;
  });

  return {
    dataset: dataset.map((row, i) => [...row, newCol[i]]),
    enOp: `- create a new column named "${op.as}" by reformatting the dates in "${op.column}" from ${currentFormatFixed} to ${desiredFormatFixed}\n`,
    newColumns: [op.as],
    warnings: [],
  };
}

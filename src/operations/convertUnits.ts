import accessCellValue from '../util/accessCellValue.ts';
import colToIndex from './colToIndex.ts';
import convert from '../util/unitConverter.ts';
import { ConvertUnitsOp } from '../types/pSQL.ts';
import { Dataset } from '../types/Dataset.ts';
import stringToNumber from '../util/stringToNumber.ts';

export default async function convertUnits(
  dataset: Dataset,
  normalizedColumns: string[],
  op: ConvertUnitsOp,
  locale: string,
  log
): Promise<{
  dataset: Dataset;
  enOp: string;
  newColumns: string[];
  warnings: string[];
}> {
  const colIndex = colToIndex(op.column, normalizedColumns);
  if (colIndex === -1) {
    throw new Error(`Unable to find specified column for unit conversion: ${op.column}`);
  }

  const { from, to } = op;
  // do we know how to convert from from to to?
  try {
    const result = await convert(0, from, to, log);
    if (result == null) {
      throw new Error(`Unsupported unit conversion ${from} -> ${to}`);
    }
  } catch (err) {
    log.error({ err }, 'Error testing conversion support');
    throw new Error(`Unsupported unit conversion ${from} -> ${to}`);
  }

  const newCol = await Promise.all(
    dataset.map(async (row) => {
      const num = stringToNumber(accessCellValue(row, colIndex, op.column)); // TODO warnings on conversion issues
      if (num == null) {
        return null;
      }
      return convert(num, from, to, log);
    })
  );

  return {
    dataset: dataset.map((row, i) => [...row, newCol[i]]),
    enOp: `- create a new column named "${op.as}" by converting the values in "${op.column}" from ${op.from} to ${op.to}\n`,
    newColumns: [op.as],
    warnings: [],
  };
}

import accessCellValue from '../util/accessCellValue.ts';
import aggregate, { friendlyFunctionText, SupportedAggregationFunctions } from './aggregate.ts';
import colToIndex from './colToIndex.ts';
import { Dataset, DatasetRow } from '../types/Dataset.ts';
import { SelectOp } from '../types/pSQL.ts';

function selectColumns(
  dataset: Dataset,
  cols: { name: string; index: number }[],
  distinct = false
): Dataset {
  const selected = dataset.map((row: DatasetRow) => {
    return cols.map((c) => accessCellValue(row, c.index, c.name));
  });
  if (!distinct) {
    return selected;
  }
  const seen = new Set();
  return selected.filter((row) => {
    const key = JSON.stringify(row);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export default function select(
  dataset: Dataset,
  normalizedColumns: string[],
  op: SelectOp,
  locale: string,
  log
): { dataset: Dataset; enOp: string; newColumns: string[]; warnings: string[] } {
  if ('columns' in op && Array.isArray(op.columns)) {
    if (op.columns.length === 0) {
      throw new Error('No columns specified in select operation');
    }
    // simple column selection operation
    const missingCols = op.columns.filter((col) => {
      if (colToIndex(col, normalizedColumns) === -1) {
        return true;
      }
      return false;
    });
    if (missingCols.length > 0) {
      throw new Error(
        `Unable to select missing columns: ${missingCols.map((c) => `"${c}"`).join(', ')}`
      );
    }
    const colIndices = op.columns.map((col) => ({
      name: col,
      index: colToIndex(col, normalizedColumns),
    }));
    return {
      dataset: selectColumns(dataset, colIndices, op.distinct),
      enOp: `- select columns: ${op.columns.map((c) => `"${c}"`).join(', ')}\n`,
      newColumns: op.columns,
      warnings: [],
    };
  }
  if ('aggregations' in op) {
    // arrays of objects sometime lead the LLM to a single object
    if (!Array.isArray(op.aggregations) && 'function' in op.aggregations) {
      op.aggregations = [op.aggregations];
    }
    // select aggregated column values
    const selectAggregations = op.aggregations
      .map((agg) => {
        return {
          column: '*', // default column to '*' if not specified
          ...agg,
        };
      })
      .filter((agg) => {
        if (!SupportedAggregationFunctions.includes(agg.function)) {
          throw new Error(
            `Unable to process unsupported row aggregation for select operation: ${agg.function}`
          );
        }
        if (agg.column === '*' && agg.function !== 'COUNT') {
          throw new Error(
            `The select aggregation ${agg.function} is not supported across columns. Only the COUNT function is available for *.`
          );
        }
        if (agg.column !== '*' && colToIndex(agg.column, normalizedColumns) === -1) {
          throw new Error(
            `Unable to perform row aggregation on missing column for select operation: ${agg.column}`
          );
        }
        return true;
      })
      .map((a) => {
        let newColName = a.as?.trim();
        if (!newColName) {
          // generate a name ourselves
          newColName = `${a.function}(${a.column || '*'})`;
        }
        return {
          ...a,
          as: newColName,
        };
      });

    if (selectAggregations.length > 0) {
      return {
        dataset: [aggregate(dataset, normalizedColumns, selectAggregations, log)],
        enOp: selectAggregations
          .map(
            (agg) =>
              `- aggregate all rows by ${friendlyFunctionText(agg.function)} of ${
                agg.column === '*' ? 'rows' : `"${agg.column}"`
              } as "${agg.as}"\n`
          )
          .join(''),
        newColumns: [...selectAggregations.map((agg) => agg.as)],
        warnings: [],
      };
    }
  } else {
    throw new Error(
      `Invalid select opertion lacking either columns or aggregations: ${JSON.stringify(op)}`
    );
  }

  return {
    dataset,
    enOp: '',
    newColumns: [],
    warnings: [],
  };
}

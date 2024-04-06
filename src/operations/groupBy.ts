import { accessCellValueWithSubproperties, getSubpropertyChain } from '../util/accessCellValue.ts';
import aggregate, { SupportedAggregationFunctions, friendlyFunctionText } from './aggregate.ts';
import colToIndex from './colToIndex.ts';
import { Dataset, DatasetCell, DatasetRow } from '../types/Dataset.ts';
import groupBy from '../util/groupBy.ts';
import { GroupByOp } from '../types/pSQL.ts';

export default function groupByColumns(
  dataset: Dataset,
  normalizedColumns: string[],
  op: GroupByOp,
  locale: string,
  log
): { dataset: Dataset; enOp: string; newColumns: string[]; warnings: string[] } {
  const desiredGroups = new Map<number, { index: number; subprops: string[][] }>();
  let groups: { [key: string]: DatasetRow[] };

  const singularGroup =
    op.columns?.length === 0 || (op.columns?.length === 1 && op.columns[0] === '*');
  if (singularGroup) {
    groups = groupBy(dataset, () => '*');
  } else {
    const uniq = [...new Set(op.columns ?? [])];
    const missingCols = [];
    uniq.forEach((col) => {
      const colIndex = colToIndex(col, normalizedColumns);
      if (colIndex === -1) {
        missingCols.push(col);
      } else if (desiredGroups.has(colIndex)) {
        // we have already seen this column, just add to its subprops
        desiredGroups.get(colIndex).subprops.push(getSubpropertyChain(col, normalizedColumns));
      } else {
        // first time seeing this column
        const subprops = [];
        if (col.includes('.')) {
          subprops.push(getSubpropertyChain(col, normalizedColumns));
        }
        desiredGroups.set(colIndex, { index: colIndex, subprops });
      }
    });

    if (missingCols.length > 0) {
      throw new Error(
        `Unable to find specified group by columns: ${missingCols.map((c) => `"${c}"`).join(', ')}`
      );
    }

    // for non-scalar dataTypes a single row can appear in more than one group
    groups = groupBy(dataset, (row) => {
      let groupKeys = [''];
      desiredGroups.forEach(({ index, subprops }) => {
        if (Array.isArray(row[index])) {
          // is this an array of objects and we are grouping by a subproperty
          // or is it an array of scalar values
          const cellVals = row[index] as Array<unknown>;
          if (cellVals.length === 0) {
            // it is probably debatable what the correct approach here is
            // if grouping by an array, if empty do you leave that row out of _any_ group
            // or do you put it in the null group, this puts it in the null group
            groupKeys = groupKeys.map(
              (gk) => `${gk}§${subprops.length > 1 ? '§'.repeat(subprops.length - 1) : ''}`
            );
          } else if (subprops.length === 0) {
            groupKeys = groupKeys.flatMap((k) => {
              return cellVals.map((v) => {
                return `${k}§${typeof v === 'object' ? JSON.stringify(v) : v}`;
              });
            });
          } else {
            groupKeys = groupKeys.flatMap((k) =>
              cellVals.map((cellVal) => {
                const keys = subprops
                  .map((path) => {
                    const v = path.reduce((acc, prop) => acc?.[prop], cellVal);
                    return typeof v === 'object' ? JSON.stringify(v) : v;
                  })
                  .join('§');
                return `${k}§${keys}`;
              })
            );
          }
        } else if (subprops.length > 0) {
          // simple scalar
          groupKeys = groupKeys.map(
            (k) =>
              `${k}§${subprops
                .map((s) => accessCellValueWithSubproperties(row, index, s))
                .join('§')}`
          );
        } else {
          // simple scalar
          groupKeys = groupKeys.map((k) => `${k}§${row[index]}`);
        }
      });
      const uniqGroups = [...new Set(groupKeys)];
      return uniqGroups.length === 1 ? uniqGroups[0] : uniqGroups;
    });
  }

  // arrays of objects sometimes lead the LLM to a single object
  if (!Array.isArray(op.aggregations) && 'function' in op.aggregations) {
    op.aggregations = [op.aggregations];
  }

  const validAggregations = (op.aggregations ?? [])
    .map((agg) => {
      return {
        column: '*', // default column to '*' if not specified
        ...agg,
      };
    })
    .filter((agg) => {
      if (!SupportedAggregationFunctions.includes(agg.function)) {
        throw new Error(`Unsupported aggregation function provided for groups: ${agg.function}`);
      }
      if (agg.column === '*') {
        if (agg.function === 'COUNT') {
          return true;
        }
        throw new Error(
          `Can only perform the COUNT aggregation on all rows (*). Requested: ${agg.function}`
        );
      }
      if (colToIndex(agg.column, normalizedColumns) === -1) {
        throw new Error(`Unable to find specified aggregation column: ${agg.column}`);
      }
      return true;
    })
    .map((agg) => {
      if (agg.function === 'COUNT' && op.columns.length === 1 && agg.column === op.columns[0]) {
        return { ...agg, column: '*' };
      }
      return agg;
    });

  if (singularGroup && validAggregations.length === 0) {
    throw new Error('Invalid attempt to aggregate all rows without any aggregation functions');
  }

  let enOp = singularGroup
    ? `- group all rows together\n`
    : `- group rows by ${op.columns.map((c) => `"${c}"`).join(' and ')}\n`;
  enOp += `${validAggregations
    .map(
      (a) =>
        `- aggregate grouped rows by ${friendlyFunctionText(a.function)} of ${
          a.column === '*' ? 'rows' : `"${a.column}"`
        } as "${a.as}"`
    )
    .join('\n')}\n`;

  return {
    dataset: Object.entries(groups).map(([g, groupRows]): DatasetRow => {
      const x = g.slice(1).split('§');
      return op.columns
        .map((ci, i) => (x[i] === '' ? null : (x[i] as DatasetCell)))
        .concat(aggregate(groupRows, normalizedColumns, validAggregations, log));
    }),
    enOp,
    newColumns: [
      ...op.columns.filter((c) => colToIndex(c, normalizedColumns) !== -1),
      ...validAggregations.map((agg) => agg.as || `${agg.function}(${agg.column})`),
    ],
    warnings: [],
  };
}

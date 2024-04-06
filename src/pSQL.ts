import { performance } from 'node:perf_hooks';

import { Logger } from 'pino';

import { Dataset } from './types/Dataset.ts';
import elapsed from './util/elapsed.ts';
import { Operation, pSQL } from './types/pSQL.ts';
import normalize from './util/normalize.ts';

// OPERATION HANDLERS
import combineColumns from './operations/combineColumns.ts';
import convertUnits from './operations/convertUnits.ts';
import dateDiff from './operations/dateDiff.ts';
import filter from './operations/filter.ts';
import formatDates from './operations/formatDates.ts';
import groupByColumns from './operations/groupBy.ts';
import limit from './operations/limit.ts';
import mapColumn from './operations/mapColumns.ts';
import offset from './operations/offset.ts';
import orderBy from './operations/orderBy.ts';
import select from './operations/select.ts';
import unwindArray from './operations/unwindArray.ts';

interface OperationResult {
  dataset: Dataset;
  enOp: string;
  newColumns?: string[];
  warnings: string[];
}

type OperationHandler = (
  dataset: Dataset,
  normalizedColumns: string[],
  op: Operation,
  locale: string,
  log: Logger
) => OperationResult | Promise<OperationResult>;

const opMap: { [opName: string]: { fx: OperationHandler; replaceColumns?: boolean } } = {
  combineColumns: { fx: combineColumns },
  convertUnits: { fx: convertUnits },
  dateDiff: { fx: dateDiff },
  filter: { fx: filter },
  formatDates: { fx: formatDates },
  groupBy: {
    fx: groupByColumns,
    replaceColumns: true,
  },
  limit: { fx: limit },
  mapColumn: { fx: mapColumn },
  offset: { fx: offset },
  orderBy: { fx: orderBy },
  select: {
    fx: select,
    replaceColumns: true,
  },
  unwindArray: { fx: unwindArray },
};

export default async function executePSQL(
  columns: { name: string; isArray?: boolean }[],
  rows: Dataset,
  psql: pSQL,
  locale: string,
  log: Logger
): Promise<{ dataset: Dataset; opsString: string; enOps: string; warnings: string[] }> {
  const innerLog = log.child({ rows: rows.length, columns: columns.length });
  let dataset = rows;
  const columnNames = columns.map((c) => c.name);
  let normalizedColumns = columnNames.map(normalize);
  let newColumnNames = columnNames;
  let opsString = `The following operations were performed on a dataset of ${rows.length.toLocaleString()} row${
    rows.length === 1 ? '' : 's'
  } and ${columns.length.toLocaleString()} column${
    columns.length === 1 ? '' : 's'
  }: | ${columnNames.join(' | ')} |\n\n`;
  let enOps = '';
  const warnings = [];

  const executeOperation = async (
    opFx: OperationHandler,
    operation: Operation,
    appendNewColumns = true
  ) => {
    const start = performance.now();
    const r = await opFx(dataset, normalizedColumns, operation, locale, innerLog);
    dataset = r.dataset;
    enOps += r.enOp;
    if (r.newColumns?.length > 0) {
      if (appendNewColumns) {
        newColumnNames = [...newColumnNames, ...r.newColumns];
        normalizedColumns = newColumnNames.map(normalize);
      } else {
        newColumnNames = r.newColumns;
        normalizedColumns = newColumnNames.map(normalize);
      }
    }
    if (r.warnings?.length > 0) {
      warnings.push(...r.warnings);
    }
  };

  for (const operation of psql.operations) {
    if (operation.op in opMap) {
      await executeOperation(
        opMap[operation.op].fx,
        operation,
        !opMap[operation.op].replaceColumns
      );
    } else {
      innerLog.error({ op: operation.op }, 'Unknown operation');
      throw new Error(`Unknown operation: ${operation.op}`);
    }
  }

  dataset = ([newColumnNames] as Dataset).concat(dataset);

  enOps = enOps.trim();
  opsString += enOps;
  opsString += `\nThis resulted in a table of ${(dataset.length - 1).toLocaleString()} row${
    dataset.length === 2 ? '' : 's'
  }`;

  return { dataset, opsString, enOps, warnings };
}

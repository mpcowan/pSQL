import { performance } from 'node:perf_hooks';

import { Logger } from 'pino';

import elapsed from '../util/elapsed.ts';
import { extractFromStructured } from './extractFromStructured.ts';
import { formatCSV, getCSVColExamples, parseCSV } from '../util/csv.ts';
import groupBy from '../util/groupBy.ts';
import { pSQL } from '../types/pSQL.ts';

export interface AgentResponse {
  facts: string[];
  psqls: pSQL[];
  enOps: string[];
  inputCSVs: string[];
  outputCSVs: string[];
  warnings: string[][];
  model: string;
  usage: {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
  };
}

export async function extractFromTable(
  csvChunks: string[],
  query: string,
  locale: string,
  log: Logger,
  retryCallback = null
): Promise<AgentResponse> {
  const start = performance.now();
  // all CSV chunks come from the same document, but may or may not be the same tables
  // attempt to collate the same tables together
  const groupedTables = groupBy(csvChunks, (s) => s.slice(0, s.indexOf('\n')));
  const sources = Object.values(groupedTables).map((tableParts) => {
    return tableParts
      .map((p, i) => (i === 0 ? p.trim() : p.slice(p.indexOf('\n')).trim()))
      .join('\n');
  });
  const tableResults = await Promise.all(
    sources.map(async (sourceTable) => {
      const tbl = sourceTable.trim();
      const examples = getCSVColExamples(tbl, 12);

      const { dataset, psql, opsString, enOps, warnings, model, usage } =
        await extractFromStructured(
          parseCSV(tbl.substring(tbl.indexOf('\n') + 1)),
          examples,
          query,
          locale,
          log,
          retryCallback
        );

      if (dataset == null) {
        return {
          facts: '',
          psql,
          enOps,
          inputCSV: sourceTable.trim().split('\n').slice(0, 6).join('\n'),
          outputCSV: '',
          warnings,
          model,
          usage,
        };
      }

      const formattedTable = formatCSV(dataset, locale);
      const truncatedTable = formattedTable.split('\n').slice(0, 51).join('\n');

      return {
        facts: `${opsString}\n\n${truncatedTable}`,
        psql,
        enOps,
        inputCSV: sourceTable.trim().split('\n').slice(0, 6).join('\n'),
        outputCSV: formattedTable,
        warnings,
        model,
        usage,
      };
    })
  );

  log.info({ elapsed: elapsed(start) }, 'Extracted facts from CSVs');

  return {
    facts: tableResults.map((r) => r.facts ?? ''),
    psqls: tableResults.map((r) => r.psql),
    enOps: tableResults.map((r) => r.enOps ?? ''),
    inputCSVs: tableResults.map((r) => r.inputCSV),
    outputCSVs: tableResults.map((r) => r.outputCSV ?? ''),
    warnings: tableResults.map((r) => r.warnings ?? []),
    model: tableResults[0].model,
    usage: accumulateUsage(tableResults),
  };
}

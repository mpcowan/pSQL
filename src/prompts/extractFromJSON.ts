import { performance } from 'node:perf_hooks';

import { Logger } from 'pino';

import { Dataset } from '../types/Dataset.ts';
import elapsed from '../util/elapsed.ts';
import { extractFromStructured } from './extractFromStructured.ts';
import { getJsonColExamples, tabularizeJson } from '../util/jsonDataset.ts';
import { pSQL } from '../types/pSQL.ts';

export interface AgentResponse {
  facts: string;
  psql: pSQL;
  enOps: string;
  outputDataset: Dataset;
  warnings: string[];
  model: string;
  usage: {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
  };
}

export async function extractFromJSON(
  flattenedJSON: object[],
  query: string,
  locale: string,
  log: Logger,
  retryCallback = null
): Promise<AgentResponse> {
  const start = performance.now();
  const fields = getJsonColExamples(flattenedJSON);
  const tabular = tabularizeJson(flattenedJSON, fields).slice(1);

  const { dataset, psql, opsString, enOps, warnings, model, usage } = await extractFromStructured(
    tabular,
    fields,
    query,
    locale,
    log,
    retryCallback
  );

  const truncated = dataset.split('\n').slice(0, 51).join('\n');

  log.info({ elapsed: elapsed(start) }, 'Extracted facts from JSON');

  return {
    facts: `${opsString}\n\n${truncated}`,
    psql,
    enOps,
    outputDataset: dataset, // TODO we could convert this back to a JSON object array from its tabular form
    warnings,
    model,
    usage,
  };
}

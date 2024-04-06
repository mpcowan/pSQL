import { performance } from 'node:perf_hooks';

import { Logger } from 'pino';

import { createChatCompletion, GPT4_TURBO_MODEL, Message } from '../apis/openai.ts';
import { Dataset } from '../types/Dataset.ts';
import elapsed from '../util/elapsed.ts';
import executePSQL from '../pSQL.ts';
import { FieldExample } from '../util/jsonDataset.ts';
import { pSQL } from '../types/pSQL.ts';
import redactPSQL from '../util/redact.ts';
import { schema } from '../schema.ts';

export interface AgentResponse {
  dataset?: Dataset;
  psql?: pSQL;
  opsString?: string;
  enOps?: string;
  warnings?: string[];
  model: string;
  usage: {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
  };
}

export function getSystemMessage(today: Date): string {
  return `You are a helpful professional data analyst with expertise in analyzing datasets using tools like SQL and MongoDB. The current timestamp is ${today.toISOString()}.

You will be given column names with example values for each column and a question. Use the processDataset function to process the dataset such that the resulting output can be used to answer the question. Use high effort. Keep it simple and straightforward.`;
}

export function getUserPrompt(count: number, fields: FieldExample[], query: string): string {
  const prompt = `Dataset with ${count.toLocaleString()} items and the following columns:

${fields
  .map(
    (f) =>
      `"${f.name}" -> ${f.distinct.toLocaleString()} distinct values${
        f.hasNulls ? ' (has nulls)' : ''
      }${f.examples.length === f.distinct ? ':' : ' such as'} ${f.examples.join(' | ')}`
  )
  .join('\n')}

---

Question:
${query.trim()}`;

  return prompt;
}

export async function extractFromStructured(
  inputDataset: Dataset,
  fields: FieldExample[],
  query: string,
  locale: string,
  log: Logger,
  previousErrors: { psql: pSQL; error: string }[] = [],
  retryCallback = null
): Promise<AgentResponse> {
  const start = performance.now();

  const messages: Message[] = [
    {
      role: 'system',
      content: getSystemMessage(new Date()),
    },
  ];

  if (previousErrors?.length > 0) {
    messages.push({
      role: 'system',
      content: `A previous attempted generated the following processing steps:\n\n${JSON.stringify(
        previousErrors[0].psql,
        null,
        2
      )}\n\nThese steps are invalid and generated the following errors:\n\n${
        previousErrors[0].error
      }\n\nPlease adjust your approach accordingly before calling the processDataset function.`,
    });
  }

  messages.push({
    role: 'user',
    content: getUserPrompt(inputDataset.length, fields, query),
  });

  const completion = await createChatCompletion(messages, {
    functions: [schema],
    functionCall: { name: 'processDataset' },
    maxTokens: 600,
    model: GPT4_TURBO_MODEL,
    priority: 'interactive',
    temperature: 0,
    retryCallback,
  });

  const jsonString = completion.choices[0].message.function_call.arguments.trim();

  let psql: pSQL;
  try {
    psql = JSON.parse(jsonString);
  } catch (err) {
    log.warn({ err }, 'Error parsing structured data extraction');
    log.error(
      { invalidContent: IN_PRODUCTION ? redactPSQL(jsonString) : jsonString },
      'Invalid LLM json'
    );

    return {
      model: completion.model,
      usage: completion.usage,
    };
  }

  // the LLM occassionally prefers to define ops like: { filter: { ... } } instead of { op: 'filter', ... }
  psql.operations = psql.operations.map((op) => {
    if (Object.keys(op).length === 1 && Object.keys(op)[0] !== 'op') {
      return { op: Object.keys(op)[0], ...op[Object.keys(op)[0]] };
    }
    return op;
  });

  if (!IN_PRODUCTION) {
    log.info({ psql, query }, 'STRUCTURED DATA EXTRACTION OPERATIONS');
  }

  // intentionally ignore drop operations unless they are the sole operation
  if (psql.operations.length > 1) {
    psql.operations = psql.operations.filter((op) => op.op !== 'drop');
  }

  if (psql.operations.length === 1 && psql.operations[0].op === 'drop') {
    log.info('Dataset deemed not helpful for question, returning empty dataset');
    return {
      dataset: [fields.map((f) => f.name)],
      psql,
      opsString: 'The dataset was deemed not relevant to the question',
      enOps: '- dropped the dataset (deemed not relevant)\n',
      warnings: [],
      model: completion.model,
      usage: completion.usage,
    };
  }

  const processingStart = performance.now();
  try {
    const data = await executePSQL(fields, inputDataset, psql, locale, log);

    const { dataset, enOps, opsString, warnings } = data;

    log.info({ elapsed: elapsed(start) }, 'Extracted from structured data');

    return {
      dataset,
      psql,
      opsString,
      enOps,
      warnings,
      model: completion.model,
      usage: completion.usage,
    };
  } catch (err) {
    if (!previousErrors || previousErrors.length === 0) {
      // this is the first retry
      log.error(
        {
          elapsed: elapsed(start),
          err,
          psql: IN_PRODUCTION ? redactPSQL(psql) : JSON.stringify(psql),
        },
        'Error performing pSQL operations. Will retry'
      );
      const retryResult = await extractFromStructured(
        inputDataset,
        fields,
        query,
        locale,
        log,
        [{ psql, error: err.message }],
        retryCallback
      );
      // add the previous usage before returning
      retryResult.usage.prompt_tokens += completion.usage.prompt_tokens;
      retryResult.usage.completion_tokens += completion.usage.completion_tokens;
      retryResult.usage.total_tokens += completion.usage.total_tokens;
      log.info({ elapsed: elapsed(start) }, 'Retried structured extraction successfully');
      return retryResult;
    }
    // give up
    log.error(
      {
        elapsed: elapsed(start),
        err,
        psql: IN_PRODUCTION ? redactPSQL(psql) : JSON.stringify(psql),
      },
      'Error performing pSQL operations. Giving up'
    );
    return {
      model: completion.model,
      usage: completion.usage,
    };
  }
}

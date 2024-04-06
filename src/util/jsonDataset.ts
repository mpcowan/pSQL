import assert from 'assert';
import { Dataset } from '../types/Dataset.ts';
import sample from './sample.ts';

export interface FieldExample {
  name: string;
  examples: (string | number | boolean)[];
  isArray?: boolean;
  hasNulls: boolean;
  distinct: number;
}

const truncateString = (str: string, len = 36): string =>
  str.length > len ? `${str.slice(0, len).trim()}…` : str;

const truncateObjectStrings = (obj: object, len = 25): object =>
  Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      if (typeof v === 'string') {
        return [k, truncateString(v, len)];
      }
      if (typeof v === 'object') {
        if (v == null) {
          return [k, v];
        }
        if (Array.isArray(v)) {
          return [
            k,
            v.map((item) => (typeof item === 'string' ? truncateString(item, len) : item)),
          ];
        }
        return [k, truncateObjectStrings(v, len)];
      }
      return [k, v];
    })
  );

export function getJsonColExamples(flattenedJSON: object[], limit = 6): FieldExample[] {
  assert(Array.isArray(flattenedJSON), 'getJsonColExamples expects an array of objects');
  // foreach field we want to get a sense of the possible values
  // for enormous datasets we could sample instead

  const examples: {
    [key: string]: {
      name: string;
      datapoints: Map<string | number | boolean, number>;
      isArray: boolean;
      hasNulls: boolean;
    };
  } = {};

  flattenedJSON.forEach((obj) => {
    Object.entries(obj).forEach(([k, v]) => {
      if (!examples[k]) {
        examples[k] = {
          name: k,
          datapoints: new Map(),
          isArray: false,
          hasNulls: false,
        };
      }
      if (v != null && (typeof v !== 'string' || v.trim() !== '')) {
        let safeValue = v;
        if (typeof v === 'string') {
          // arbitrarily truncate long strings for token length safety
          // example strings we want to avoid truncating:
          // ISO timestamps: 2023-12-20T13:39:57.606Z (24 chars)
          safeValue = truncateString(v);
        }
        if (Array.isArray(v)) {
          // since the intention of generating examples is to pass to the LLM
          // we need to be cautious about the size of the examples
          // truncate the array based on its contents and be careful to sample
          if (v.every((item) => ['string', 'number', 'boolean'].includes(typeof item))) {
            safeValue = sample(v, 2).map((item) =>
              typeof item === 'string' ? truncateString(item) : item
            );
          } else {
            safeValue = sample(v, 1).map((item) => truncateObjectStrings(item));
          }
          // if the value is an array we need to stringify it
          safeValue = JSON.stringify(safeValue);
          examples[k].isArray = true;
        }
        if (examples[k].datapoints.has(safeValue)) {
          examples[k].datapoints.set(safeValue, examples[k].datapoints.get(safeValue) + 1);
        } else {
          examples[k].datapoints.set(safeValue, 1);
        }
      } else {
        examples[k].hasNulls = true;
      }
    });
  });

  // sort the field examples by frequency and truncate
  return Object.values(examples)
    .map((ex) => ({
      name: ex.name,
      isArray: ex.isArray,
      examples: [...ex.datapoints]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map((d) => d[0]),
      hasNulls: ex.hasNulls,
      distinct: ex.datapoints.size,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function tabularizeJson(flattenedJSON: object[], fieldExamples: FieldExample[]): Dataset {
  const headers = fieldExamples.map((ex) => ex.name);
  const rows = flattenedJSON.map((obj) => fieldExamples.map((ex) => obj[ex.name] ?? null));
  return [headers, ...rows];
}

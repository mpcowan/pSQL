import { createHash as create } from 'node:crypto';

import Papa from 'papaparse';

import { Dataset } from '../types/Dataset.ts';

const truncateString = (str: string, len = 36): string =>
  str.length > len ? `${str.slice(0, len).trim()}…` : str;

export function parseCSV(input: string): Dataset {
  const parsed = Papa.parse(input, {
    delimiter: ',',
    dynamicTyping: false,
  });

  return parsed.data;
}

export function formatCSV(csv: Dataset, locale: string): string {
  const numberFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 6 });
  const formattedCSV = csv.map((row) =>
    row.map((cell) => {
      if (typeof cell === 'number') {
        return numberFormatter.format(cell);
      }
      return cell;
    })
  );
  return Papa.unparse(formattedCSV, { newline: '\n' });
}

export function fillEmptyColNames(sourceTableHeaders: string): string[] {
  const parsedSourceHeaders = Papa.parse(sourceTableHeaders, { delimiter: ',' }).data[0].map(
    (header) => header?.trim() ?? ''
  );
  // assign column names to columns with missing headers
  const usedColumnNames = new Set();
  return parsedSourceHeaders.map((header, i) => {
    let newHeader = (header || `#${i + 1}`).replace(/\.\s/g, ' ').replace(/\./g, '_').trim();
    if (!usedColumnNames.has(newHeader)) {
      usedColumnNames.add(newHeader);
      return newHeader;
    }
    // if the column name is already used, append a number to it to make it unique
    newHeader = `${newHeader}(2)`;
    for (let j = 2; usedColumnNames.has(newHeader); j += 1) {
      newHeader = newHeader.replace(/\(\d+\)$/, `(${j})`);
    }
    usedColumnNames.add(newHeader);
    return newHeader;
  });
}

// the first line is expected to be column names
export function getCSVColExamples(
  csv: string,
  limit = 10
): { name: string; examples: string[]; hasNulls: boolean; distinct: number }[] {
  const parsed = Papa.parse(csv, {
    delimiter: ',',
    dynamicTyping: false,
  });

  const tbl = parsed.data;
  const headers = fillEmptyColNames(Papa.unparse([tbl[0]], { newline: '\n' }));
  const rows = tbl.slice(1);

  const examples = headers.map((h) => {
    return {
      name: h,
      datapoints: new Map(),
      hasNulls: false,
    };
  });

  // foreach column we want to get a sense of the possible values
  // for enormous tables we could sample instead
  rows.forEach((row) => {
    row.forEach((cell, colIndex) => {
      if (cell != null && cell.trim() !== '') {
        const val = truncateString(cell.trim());
        if (examples[colIndex].datapoints.has(val)) {
          examples[colIndex].datapoints.set(val, examples[colIndex].datapoints.get(val) + 1);
        } else {
          examples[colIndex].datapoints.set(val, 1);
        }
      } else {
        examples[colIndex].hasNulls = true;
      }
    });
  });

  // sort the column examples by frequency and truncate
  return examples.map((ex) => {
    let samples = [...ex.datapoints]
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.max(20, limit))
      .map((d) => d[0]);
    // if the samples appear to be tricky date formats, allow over the limit
    if (samples.some((s) => !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s))) {
      samples = samples.slice(0, limit);
    }
    return {
      name: ex.name,
      examples: samples,
      hasNulls: ex.hasNulls,
      distinct: ex.datapoints.size,
    };
  });
}

export function getTableHash(csv: string): string {
  return create('sha256')
    .update(JSON.stringify(getCSVColExamples(csv, 12)))
    .digest('hex');
}

import { DateTime } from 'luxon';

import fixDateTokens from './fixDateTokens.ts';

// distinguish between certain date formats
// M/d/yy -> 8/6/23
// MM/dd/yy -> 08/06/23
// d/M/yy -> 6/8/23
// dd/MM/yy -> 06/08/23
export function guessDateFormat(vals: string[]) {
  // to do this we look at the entire column to determine statistics
  const stats = {
    n: 0,
    m: 0,
    a: {
      cardinality: new Set(),
      leadingZero: false,
      max: 0,
      min: 0,
    },
    b: {
      cardinality: new Set(),
      leadingZero: false,
      max: 0,
      min: 0,
    },
    c: {
      cardinality: new Set(),
      leadingZero: false,
      max: 0,
      min: 0,
    },
  };

  vals.forEach((s) => {
    if (s == null) {
      return;
    }
    const trimmed = s.trim();
    if (!/\d/.test(trimmed)) {
      return;
    }
    stats.n += 1;
    if (!/^\d{1,4}\/\d{1,2}\/\d{1,4}$/.test(trimmed)) {
      return;
    }
    stats.m += 1;
    const [, a, b, c] = /^(\d{1,4})\/(\d{1,2})\/(\d{1,4})$/.exec(trimmed);
    // track leading 0s
    if (a.startsWith('0')) {
      stats.a.leadingZero = true;
    }
    if (b.startsWith('0')) {
      stats.b.leadingZero = true;
    }
    if (c.startsWith('0')) {
      stats.c.leadingZero = true;
    }
    // track cardinality
    stats.a.cardinality.add(a);
    stats.b.cardinality.add(b);
    stats.c.cardinality.add(c);
    // track extremes
    const aInt = parseInt(a, 10);
    if (aInt > stats.a.max) {
      stats.a.max = aInt;
    }
    if (aInt < stats.a.min) {
      stats.a.min = aInt;
    }

    const bInt = parseInt(b, 10);
    if (bInt > stats.b.max) {
      stats.b.max = bInt;
    }
    if (bInt < stats.b.min) {
      stats.b.min = bInt;
    }

    const cInt = parseInt(c, 10);
    if (cInt > stats.c.max) {
      stats.c.max = cInt;
    }
    if (cInt < stats.c.min) {
      stats.c.min = cInt;
    }
  });

  if (stats.m === 0 || stats.n > stats.m) {
    return null;
  }

  // based on the stats, what format do we think is being used?
  const format = {
    a: '',
    b: '',
    c: '',
  };

  if (stats.a.max > 12 && stats.a.max < 32) {
    // a must be the days
    format.a = stats.a.leadingZero ? 'dd' : 'd';
    // assume b is then months
    format.b = stats.b.leadingZero ? 'MM' : 'M';
    // assume c is then years
    format.c = stats.c.max > 999 ? 'yyyy' : 'yy';
  } else if (stats.b.max > 12 && stats.b.max < 32) {
    // b must be the days
    format.b = stats.b.leadingZero ? 'dd' : 'd';
    // assume a is then months
    format.a = stats.a.leadingZero ? 'MM' : 'M';
    // assume c is then years
    format.c = stats.c.max > 999 ? 'yyyy' : 'yy';
  } else if (stats.a.max > 31) {
    // perhaps its yyyy/MM/dd?
    format.a = stats.a.max > 999 ? 'yyyy' : 'yy';
    format.b = stats.b.leadingZero ? 'MM' : 'M';
    format.c = stats.c.leadingZero ? 'dd' : 'd';
  } else {
    // nothing obvious, guess based on cardinality
    const aCardinality = stats.a.cardinality.size;
    const bCardinality = stats.b.cardinality.size;
    if (aCardinality > bCardinality) {
      format.a = stats.a.leadingZero ? 'dd' : 'd';
      // assume b is then months
      format.b = stats.b.leadingZero ? 'MM' : 'M';
    } else {
      format.b = stats.b.leadingZero ? 'dd' : 'd';
      // assume a is then months
      format.a = stats.a.leadingZero ? 'MM' : 'M';
    }
    // assume c is then years
    format.c = stats.c.max > 999 ? 'yyyy' : 'yy';
  }

  return `${format.a}/${format.b}/${format.c}`;
}

export default function stringToDate(
  s: string | number | boolean | null | Date | DateTime,
  format?: string
): DateTime | null {
  if (s == null) {
    return null;
  }

  if (typeof s === 'object' && s.isValid) {
    // it is already a DateTime
    return s;
  }

  if (s instanceof Date) {
    return DateTime.fromJSDate(s, { zone: 'utc' });
  }

  if (typeof s === 'boolean') {
    return null;
  }

  const str = `${s}`.trim();
  if (str === '') {
    return null;
  }

  // check to see if value is perhaps an ISO 8601 format
  const asIso = DateTime.fromISO(str, { zone: 'utc' });
  if (asIso.isValid) {
    return asIso;
  }

  // if the LLM provided a format guess, try that first before we use our own heuristics
  if (format) {
    try {
      const d = DateTime.fromFormat(str, fixDateTokens(format), { zone: 'utc' });
      if (d.isValid) {
        return d;
      }
    } catch (err) {
      // let it fall through to our heuristics
    }
  }

  // reduce the number of cases we need to handle
  const simple = str.replace(/,/g, '').replace(/(\d)(?:st|nd|rd|th)\s/g, '$1 ');

  // if there are no digits in the string it can't possibly be a date
  if (!/\d/.test(str)) {
    return null;
  }

  // July 4th, 1776 | August 12 233 | Apr 4, 1998
  if (/^[abcdefghijlmnoprstuvy]{3,9}[\s-]\d{1,2}[\s-]\d{1,4}$/i.test(simple)) {
    const shortMonth = /^\w{3}[\s-]/i.test(simple);
    const firstSeparator = /^\w{3,9}(\s|-)/.exec(simple)[1];
    const leadingZero = /^\w{3,9}[\s-](\d{1,2})[\s-]/.exec(simple)[1].startsWith('0');
    const secondSeparator = /\d{1,2}(\s|-)\d{1,4}$/i.exec(simple)[1];
    const yearStr = /[\s-](\d{1,4})$/.exec(simple)[1];
    let yearTokens;
    switch (yearStr.length) {
      case 1:
        yearTokens = 'y';
        break;
      case 2:
        yearTokens = 'yy';
        break;
      case 3:
        yearTokens = 'y';
        break;
      case 4:
        yearTokens = 'yyyy';
        break;
      default:
        // impossible
        break;
    }
    const d = DateTime.fromFormat(
      simple,
      `${shortMonth ? 'MMM' : 'MMMM'}${firstSeparator}${
        leadingZero ? 'dd' : 'd'
      }${secondSeparator}${yearTokens}`,
      { zone: 'utc' }
    );
    if (d.isValid) {
      return d;
    }
    return null;
  }

  // 2 Aug 1947 | 28-Dec-23 | 4-Jul-1776
  if (/^\d{1,2}[\s-][abcdefghijlmnoprstuvy]{3,9}[\s-]\d{1,4}$/i.test(simple)) {
    const leadingZero = simple.startsWith('0');
    const firstSeparator = /^\d{1,2}(\s|-)/.exec(simple)[1];
    const shortMonth = /^\d{1,2}[\s-]\w{3}[\s-]/i.test(simple);
    const secondSeparator = /[abcdefghijlmnoprstuvy]{3,9}(\s|-)\d{1,4}$/i.exec(simple)[1];
    const yearStr = /[\s-](\d{1,4})$/.exec(simple)[1];
    let yearTokens;
    switch (yearStr.length) {
      case 1:
        yearTokens = 'y';
        break;
      case 2:
        yearTokens = 'yy';
        break;
      case 3:
        yearTokens = 'y';
        break;
      case 4:
        yearTokens = 'yyyy';
        break;
      default:
        // impossible
        break;
    }
    const d = DateTime.fromFormat(
      simple,
      `${leadingZero ? 'dd' : 'd'}${firstSeparator}${
        shortMonth ? 'MMM' : 'MMMM'
      }${secondSeparator}${yearTokens}`,
      { zone: 'utc' }
    );
    if (d.isValid) {
      return d;
    }
    return null;
  }

  // new Date().toDateString() for en -> Fri Sep 15 2023 or Sat Sep 02 2023
  if (/^[adefhimnorstuwy]{3,9}\s[abcdefghijlmnoprstuvy]{3,9}\s\d{1,2}\s\d{1,4}$/i.test(simple)) {
    const shortDay = /^\w{3}\s/i.test(simple);
    const shortMonth = /^\w+\s\w{3}\s/i.test(simple);
    const d = DateTime.fromFormat(
      simple,
      `${shortDay ? 'EEE' : 'EEEE'} ${shortMonth ? 'MMM' : 'MMMM'} dd yyyy`,
      { zone: 'utc' }
    );
    if (d.isValid) {
      return d;
    }
    return null;
  }

  const asRfc2822 = DateTime.fromRFC2822(str, { zone: 'utc' });
  if (asRfc2822.isValid) {
    return asRfc2822;
  }

  const asHttp = DateTime.fromHTTP(str, { zone: 'utc' });
  if (asHttp.isValid) {
    return asHttp;
  }

  // Fiscal calendar e.g. Q3 2022, Q4FY23, Q1'22
  if (/Q[1234]\s?'?(?:FY)?(\d{2}|\d{4})$/i.test(simple)) {
    const [, quarter, year] = /Q([1234])\s?'?(?:FY)?(\d{2}|\d{4})$/i.exec(simple);
    let fullYear = parseInt(year, 10);
    if (fullYear < 100) {
      // shorthand year, convert to full year
      if (fullYear > new Date().getFullYear() - 2000 + 10) {
        fullYear += 1900;
      } else {
        fullYear += 2000;
      }
    }
    // while the exact dates for fiscal quarters can vary by company
    // for the sake of comparison and ordering, here we assume the most common
    switch (quarter) {
      case '1':
        return DateTime.fromISO(`${fullYear}-01-01`, { zone: 'utc' });
      case '2':
        return DateTime.fromISO(`${fullYear}-04-01`, { zone: 'utc' });
      case '3':
        return DateTime.fromISO(`${fullYear}-07-01`, { zone: 'utc' });
      case '4':
        return DateTime.fromISO(`${fullYear}-10-01`, { zone: 'utc' });
      default:
        // not possible
        break;
    }
  }

  // arbitrary numbers like 1542674993410 (Unix timestamps) can't be reliably interpreted
  // for instance you can't tell if that is milliseconds or seconds

  // there is a lot of opportunity here to add more heuristics for common formatting

  return null;
}

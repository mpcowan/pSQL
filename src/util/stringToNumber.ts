export default function stringToNumber(s: unknown): number | null {
  if (s == null) {
    return null;
  }

  if (typeof s === 'number') {
    return s;
  }

  if (typeof s === 'boolean') {
    return s ? 1 : 0;
  }

  if (typeof s !== 'string') {
    return null;
  }

  if (!/\d/.test(s)) {
    return null;
  }

  let st = s.trim();
  if (/^-?\d+$/.test(st)) {
    return parseInt(st, 10);
  }

  // string isn't just clean digits, but there are some

  if (/\p{Sc}/u.test(s)) {
    // this is possibly a monetary value
    st = st.replace(/\p{Sc}/gu, '');
    // e.g. $12 | $3.45 | €1.234.567,89
  }

  // scientific notation
  if (/^\d+(?:\.\d+)?e\d+$/.test(st)) {
    return parseFloat(st);
  }

  if (/^-?(?:\d{1,2}[,.\s])?(?:\d{3}[,.\s])*\d{1,3}(?:[,.]\d+)?\s?\p{L}*$/u.test(st)) {
    // remove unit specifiers e.g. 123 USD | 12 bushels | 12.2 knots | 65 mph | 15mpg
    st = st.replace(/\s?\p{L}*$/gu, '');
    // this is a formatted number, do our best
    if (!st.includes(',') && !st.includes('.')) {
      return parseInt(st.replace(/\s/g, ''), 10);
    }
    if (/,.*?\..*?,/.test(st) || /\..*?,.*?\./.test(st)) {
      // mixed delimiters, not a valid number
      return null;
    }
    if (/\s/.test(st) && st.includes(',')) {
      return parseFloat(st.replace(/[\s]/g, '').replace(',', '.'));
    }
    if (/\s/.test(st) && st.includes('.')) {
      return parseFloat(st.replace(/[\s]/g, ''));
    }

    if (st.includes('.') && st.includes(',')) {
      if (st.indexOf(',') < st.indexOf('.')) {
        // the radix character (decimal separator) is .
        return parseFloat(st.replace(/,/g, ''));
      }
      if (st.indexOf('.') < st.indexOf(',') || st.indexOf(' ') < st.indexOf(',')) {
        // the radix is , parseFloat needs it to be .
        return parseFloat(st.replace(/[\s.]/g, '').replace(',', '.'));
      }
    }

    // only has .
    if (st.includes('.')) {
      // the number 1.234 is ambiguous: in EN its 1.234 but in ES its 1234
      // sadly we are just going to default to the EN interpretation here
      if ((st.match(/\./g) || []).length > 1) {
        // must be thousands
        return parseInt(st.replace(/\./g, ''), 10);
      }
      return parseFloat(st);
    }

    // only has ,
    if (st.includes(',')) {
      // the number 1,234 is ambiguous: in EN is 1234 and in ES its 1.234
      // sadly we are just going to default to the EN interpretation here
      if ((st.match(/,/g) || []).length > 1) {
        // must be thousands
        return parseInt(st.replace(/,/g, ''), 10);
      }
      // just a single comma
      if (/^0,/.test(st)) {
        return parseFloat(st.replace(',', '.'));
      }
      if (/,\d{3}$/.test(st)) {
        // treat as EN thousands
        return parseInt(st.replace(/,/g, ''), 10);
      }
      return parseFloat(st.replace(',', '.'));
    }
  }

  // e.g. 6543.21
  if (/^-?\d{4,}\.\d+$/.test(st)) {
    return parseFloat(st);
  }

  return null;
}

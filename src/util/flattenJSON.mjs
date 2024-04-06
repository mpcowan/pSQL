/**
 * Flattens a JSON object into a single-level object with underscore-separated keys.
 */
export default function flattenJSON(json, arrayMapping = {}, path = []) {
  const flattened = {};

  if (['string', 'number', 'boolean'].includes(typeof json)) {
    return json;
  }

  if (json == null) {
    return json;
  }

  if (Array.isArray(json)) {
    return json.map((v) => flattenJSON(v, arrayMapping, []));
  }

  Object.entries(json).forEach(([k, v]) => {
    const safeKey = k.replace(/\./g, '_');
    const flatKey = path.concat([safeKey]).join('_');
    if (['string', 'number', 'boolean'].includes(typeof v)) {
      flattened[flatKey] = v;
      return;
    }
    if (Array.isArray(v)) {
      flattened[flatKey] = (
        typeof arrayMapping[flatKey] === 'function' ? v.map(arrayMapping[flatKey]) : v
      ).map((vi) => flattenJSON(vi, arrayMapping, []));
      return;
    }
    if (v == null) {
      // we intentionally drop out nulls as you don't know what the null was supposed to be
      return; // no-op
    }
    if (typeof v === 'object') {
      Object.assign(flattened, flattenJSON(v, arrayMapping, [...path, safeKey]));
    }
  });

  return flattened;
}

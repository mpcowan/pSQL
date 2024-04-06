import { pSQL } from '../types/pSQL.ts';

export default function redactPSQL(psql: pSQL | string): string {
  return (typeof psql === 'string' ? psql : JSON.stringify(psql, null, 2))
    .replace(/("(?:column|as|value)":\s?").*?("(?:,|\}))/gi, '$1$2')
    .replace(/("(?:columns|values)":\s?\[).*?(\](?:,|\}))/gi, '$1$2');
}

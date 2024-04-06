export default function normalize(s: unknown): string | null {
  if (s == null) {
    return null;
  }
  return `${s}`
    .trim()
    .replaceAll('”', '"')
    .replaceAll('“', '"')
    .replaceAll('’', "'")
    .replaceAll('\u00A0', ' ')
    .replaceAll(/^@/g, '') // remove leading @ to account for @mentions
    .toLowerCase();
}

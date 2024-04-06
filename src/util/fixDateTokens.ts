export default function fixDateTokens(tokens?: string): string | null {
  if (tokens == null) {
    return null;
  }
  return tokens
    .replace(/Y/g, 'y')
    .replace(/D/g, 'd')
    .replace(/A/g, 'a')
    .replace(/w/g, 'W')
    .replace(/[{}]/g, '');
}

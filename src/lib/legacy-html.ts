import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function legacyHtml(filename: string) {
  return readFileSync(resolve(process.cwd(), 'src/content/legacy', filename), 'utf8');
}

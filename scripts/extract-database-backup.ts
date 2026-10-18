// Extracts a verified backup into a NEW folder, never over a running school's data.
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join, sep } from 'node:path';
import { readDatabaseWorkbook } from '../server/databaseWorkbook';
const [input, destination] = process.argv.slice(2);
if (!input || !destination)
  throw Error(
    'Usage: node --import tsx scripts/extract-database-backup.ts backup.xlsx NEW_OUTPUT_FOLDER',
  );
const root = resolve(destination);
if (existsSync(root))
  throw Error('Choose a new output folder; existing files will not be replaced.');
const files = await readDatabaseWorkbook(readFileSync(resolve(input)));
for (const file of files) {
  const target = resolve(join(root, file.path));
  if (!target.startsWith(root + sep)) throw Error('Invalid backup path');
}
mkdirSync(root, { recursive: true });
for (const file of files) {
  const target = join(root, file.path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, file.bytes, { flag: 'wx' });
}
console.log(`Verified and extracted ${files.length} database files to ${root}`);

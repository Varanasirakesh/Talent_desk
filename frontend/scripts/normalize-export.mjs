import { readdir, copyFile, readFile } from 'node:fs/promises';
import path from 'node:path';

// Next 16.3 static export uses POSIX separators when naming RSC segment files.
// On Windows its source path can retain backslashes, producing nested folders.
// Supply the flat filenames the browser requests; keep original files intact.
const root = path.resolve(process.argv[2] || 'out');
async function visit(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await visit(file));
    else result.push(file);
  }
  return result;
}
let count = 0;
for (const file of await visit(root)) {
  const parts = path.relative(root, file).split(path.sep);
  const marker = parts.findIndex(part => part.startsWith('__next.'));
  if (marker < 0 || marker === parts.length - 1 || !file.endsWith('.txt')) continue;
  const target = path.join(root, ...parts.slice(0, marker), parts.slice(marker).join('.'));
  try {
    const existing = await readFile(target);
    if (!existing.equals(await readFile(file))) throw new Error('Conflicting segment: '+target);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await copyFile(file, target);
    count++;
  }
}
console.log('Static export segment aliases: '+count);

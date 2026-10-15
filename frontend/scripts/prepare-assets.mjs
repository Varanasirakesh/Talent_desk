import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const require = createRequire(import.meta.url);
const worker = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs');
await mkdir(new URL('public/', root), { recursive: true });
await copyFile(worker, new URL('public/pdf.worker.min.mjs', root));
console.log(`PDF worker prepared in ${fileURLToPath(new URL('public/', root))}`);

import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
await mkdir(new URL('public/', root), { recursive: true });
await copyFile(new URL('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', root), new URL('public/pdf.worker.min.mjs', root));
console.log(`PDF worker prepared in ${fileURLToPath(new URL('public/', root))}`);

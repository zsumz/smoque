import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createPublicApiReport } from './public-api-report.mts';

const root = path.resolve(import.meta.dirname, '../../..');
const reportPath = path.join(root, 'etc/public-api.api.md');
const { report, diagnostics } = createPublicApiReport(root);

if (diagnostics.length > 0) {
    throw new Error(diagnostics.join('\n'));
}
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, report);
console.log('Updated etc/public-api.api.md.');

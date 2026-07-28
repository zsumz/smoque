import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createPublicApiReport } from './public-api-report.mts';

const apiReportPath = 'etc/public-api.api.md';

export async function inspectPublicApi(root: string): Promise<string[]> {
    const { report, diagnostics } = createPublicApiReport(root);
    if (diagnostics.length > 0) {
        return diagnostics;
    }
    const expected = await readFile(path.join(root, apiReportPath), 'utf8')
        .catch(() => undefined);
    if (expected === undefined) {
        return [`${apiReportPath}: public API report is missing; run npm run api:update.`];
    }
    return expected === report
        ? []
        : [`${apiReportPath}: public API signatures changed; review and run npm run api:update.`];
}

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

const finalizeWorkflow = fileURLToPath(new URL(
    '../../.github/workflows/release-finalize.yml',
    import.meta.url,
));
const stageWorkflow = fileURLToPath(new URL(
    '../../.github/workflows/release.yml',
    import.meta.url,
));

test('staged publishing requires provenance', async () => {
    const workflow = await readFile(stageWorkflow, 'utf8');

    assert.match(
        workflow,
        /npm stage publish \\\n(?:\s+.*\\\n)+\s+--provenance/u,
    );
});

test('manual release input crosses one environment boundary', async () => {
    const workflow = await readFile(finalizeWorkflow, 'utf8');
    const directInput = '${{ inputs.version }}';
    const occurrences = workflow.split(directInput).length - 1;

    assert.equal(occurrences, 1);
    assert.match(
        workflow,
        /SMOQUE_RELEASE_VERSION: \$\{\{ inputs\.version \}\}/u,
    );
    assert.match(
        workflow,
        /node scripts\/release\/verify-release\.mts "v\$SMOQUE_RELEASE_VERSION"/u,
    );
});

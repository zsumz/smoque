import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

const callerWorkflow = fileURLToPath(new URL(
    '../../.github/workflows/sallyport.yml',
    import.meta.url,
));

test('sallyport workflows use one immutable implementation', async () => {
    const workflow = await readFile(callerWorkflow, 'utf8');
    const references = [...workflow.matchAll(
        /uses: zsumz\/sallyport\/\.github\/workflows\/(?:stage|finalize)\.yml@([0-9a-f]{40})/gu,
    )];

    assert.equal(references.length, 2);
    assert.equal(references[0]?.[1], references[1]?.[1]);
});

test('the caller exposes only least-privilege release authority', async () => {
    const workflow = await readFile(callerWorkflow, 'utf8');

    assert.match(workflow, /^permissions: \{\}$/mu);
    assert.match(
        workflow,
        /stage:\n(?:.*\n)*? {6}actions: read\n {6}contents: read\n {6}id-token: write\n/u,
    );
    assert.match(
        workflow,
        /finalize:\n(?:.*\n)*? {6}actions: read\n {6}contents: write\n/u,
    );
    assert.doesNotMatch(workflow, /secrets:\s+inherit/u);
    assert.doesNotMatch(workflow, /npm (?:publish|stage)/u);
});

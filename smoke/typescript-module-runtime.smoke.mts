import { expect, smoke } from 'smoque';
import { nativeTypeScriptMessage } from './typescript-runtime-support.ts';

smoke.suite('TypeScript module smoke files run without a build step', async (t) => {
    await t.step('import sibling TypeScript module', () => {
        expect.value(nativeTypeScriptMessage()).toContain('TypeScript');
    });
});

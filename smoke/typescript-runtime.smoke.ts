import { expect, smoke, type SmokeContext } from 'smoque';
import { nativeTypeScriptMessage } from './typescript-runtime-support.ts';

smoke.suite('TypeScript smoke files run without a build step', async (t: SmokeContext) => {
    await t.step('execute typed smoke code', () => {
        const message = nativeTypeScriptMessage();

        expect.value(message).toContain('TypeScript');
    });
});

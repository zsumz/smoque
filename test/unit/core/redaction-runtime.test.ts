import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';

import { createTerminalReporter, resetSmokeRegistry, runRegisteredSuites, smoke } from '../../../dist/core.js';
import { escapeRegExp } from './redaction-reporters.js';

beforeEach(() => {
    resetSmokeRegistry();
});

test('t.redact scrubs process readiness details', async () => {
    const secret = 'process-token-123';
    let terminal = '';
    const reporter = createTerminalReporter({
        write(text) {
            terminal += text;
        },
    });

    smoke.suite('redacted process', async (t) => {
        t.redact(secret);

        await t.step('timeout with secret logs', async () =>
            t.process.start(
                process.execPath,
                [
                    '-e',
                    `
            console.log(${JSON.stringify(`boot ${secret}`)});
            console.error(${JSON.stringify(`err ${secret}`)});
            setInterval(() => {}, 1000);
          `,
                ],
                {
                    ready: {
                        description: `secret probe ${secret}`,
                        async check() {
                            await Promise.resolve();
                            return { ready: false, message: `waiting ${secret}` };
                        },
                    },
                    timeout: '500ms',
                },
            ),
        );
    });

    const result = await runRegisteredSuites({
        repoRoot: process.cwd(),
        eventSink: reporter,
    });

    assert.equal(result.status, 'failed');
    assert.doesNotMatch(JSON.stringify(result), new RegExp(escapeRegExp(secret), 'u'));
    assert.doesNotMatch(terminal, new RegExp(escapeRegExp(secret), 'u'));
    assert.match(terminal, /\[redacted\]/u);
});

test('env string redaction registers read values', async () => {
    const secret = 'env-token-456';
    const previous = process.env.SMOQUE_REDACTION_SECRET;
    let terminal = '';
    process.env.SMOQUE_REDACTION_SECRET = secret;

    try {
        const reporter = createTerminalReporter({
            write(text) {
                terminal += text;
            },
        });

        smoke.suite('redacted env', async (t) => {
            const value = t.env.string('SMOQUE_REDACTION_SECRET', { required: true, redact: true });

            await t.step('fail with env value', () => {
                throw new Error(`env value ${value}`);
            });
        });

        const result = await runRegisteredSuites({
            repoRoot: process.cwd(),
            eventSink: reporter,
        });

        assert.equal(result.status, 'failed');
        assert.doesNotMatch(JSON.stringify(result), new RegExp(escapeRegExp(secret), 'u'));
        assert.doesNotMatch(terminal, new RegExp(escapeRegExp(secret), 'u'));
        assert.match(terminal, /\[redacted\]/u);
    } finally {
        if (previous === undefined) {
            Reflect.deleteProperty(process.env, 'SMOQUE_REDACTION_SECRET');
        } else {
            process.env.SMOQUE_REDACTION_SECRET = previous;
        }
    }
});

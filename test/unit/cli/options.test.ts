import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
    parseListOptions,
    parseRunOptions,
    parseSnippetOptions,
} from '../../../dist/cli/args/options.js';
import { escapeRegExp } from '../../../dist/shared/text-pattern.js';

test('CLI option parsing retains flags, repeated tags, and positional patterns', () => {
    assert.deepEqual(
        parseRunOptions([
            'smoke/',
            '--ci',
            '--tag',
            'fast, api',
            '--tag',
            'database',
            '--skip-tag',
            'slow',
            '--json',
            'result.json',
        ]),
        {
            pattern: 'smoke/',
            ci: true,
            keepWorkdirOnFail: true,
            tags: ['fast', 'api', 'database'],
            skipTags: ['slow'],
            json: 'result.json',
        },
    );
    assert.deepEqual(parseListOptions(['--tag', 'fast', 'smoke/']), {
        tags: ['fast'],
        pattern: 'smoke/',
    });
    assert.deepEqual(parseSnippetOptions(['README.md', '--timeout', '10s']), {
        pattern: 'README.md',
        timeout: '10s',
    });
});

test('CLI option parsing retains smoque token and error-message semantics', () => {
    for (const [args, message] of [
        [['--json=report.json'], 'Unknown smoque run option: --json=report.json'],
        [['--ci=true'], 'Unknown smoque run option: --ci=true'],
        [['--'], 'Unknown smoque run option: --'],
        [['-abc'], 'Unknown smoque run option: -abc'],
        [['-'], 'Unknown smoque run option: -'],
    ] as const) {
        assert.throws(
            () => parseRunOptions([...args]),
            new RegExp(escapeRegExp(message), 'u'),
        );
    }

    assert.throws(
        () => parseRunOptions(['--json', '--ci']),
        /--json requires a value\./u,
    );
});

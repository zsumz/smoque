import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { SmokeError } from '../../errors.js';
import { pathToString } from '../../path-ref.js';
import { isNotFoundError, pathExists } from '../../shared/fs.js';
import {
    formatTextPattern,
    matchesTextPattern,
} from '../../shared/text-pattern.js';
import type { ChecksumAlgorithm } from '../../types/checksum.js';
import type { ExecutableOptions } from '../../types/expectations.js';
import type { PathRef } from '../../types/path-ref.js';
import { createJsonPathExpectation, parseStructuredJson } from '../json-path-expectation.js';
import type { FileExpectation, JsonPathExpectation } from '../types.js';
import { assertExecutableFile } from './executable-file.js';

export function createFileExpectation(path: string | PathRef): FileExpectation {
    const target = pathToString(path);

    return {
        async toExist(): Promise<void> {
            if (!await pathExists(target)) {
                throw new SmokeError(`Expected file to exist: ${target}`, { path: target });
            }
        },
        async notToExist(): Promise<void> {
            if (await pathExists(target)) {
                throw new SmokeError(`Expected file not to exist: ${target}`, { path: target });
            }
        },
        async toContain(expected): Promise<void> {
            const content = await readExistingFile(target);
            if (!matchesTextPattern(content, expected)) {
                throw new SmokeError(`Expected file to contain ${formatTextPattern(expected)}: ${target}`, {
                    path: target,
                    expected: formatTextPattern(expected),
                });
            }
        },
        async notToContain(expected): Promise<void> {
            const content = await readExistingFile(target);
            if (matchesTextPattern(content, expected)) {
                throw new SmokeError(`Expected file not to contain ${formatTextPattern(expected)}: ${target}`, {
                    path: target,
                    expected: formatTextPattern(expected),
                });
            }
        },
        async toBeExecutable(options: ExecutableOptions = {}): Promise<void> {
            await assertExecutableFile(target, options);
        },
        async toHaveChecksum(algorithm: ChecksumAlgorithm, expected: string): Promise<void> {
            const content = await readFile(target);
            const actual = createHash(algorithm).update(content).digest('hex');

            if (actual.toLowerCase() !== expected.toLowerCase()) {
                throw new SmokeError(`Expected ${algorithm} checksum to match: ${target}`, {
                    path: target,
                    algorithm,
                    expected,
                    actual,
                });
            }
        },
        jsonPath(path): JsonPathExpectation {
            return createJsonPathExpectation(async () => {
                const text = await readExistingFile(target);
                return parseStructuredJson(text, {
                    source: 'file',
                    path: target,
                });
            }, path, {
                source: 'file',
                path: target,
            });
        },
    };
}

async function readExistingFile(path: string): Promise<string> {
    try {
        return await readFile(path, 'utf8');
    } catch (error) {
        if (isNotFoundError(error)) {
            throw new SmokeError(`Expected file to exist: ${path}`, { path });
        }
        throw error;
    }
}

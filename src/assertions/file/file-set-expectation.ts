import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';

import { SmokeError } from '../../errors.js';
import { pathToString } from '../../path-ref.js';
import {
    formatTextPattern,
    matchesTextPattern,
} from '../../shared/text-pattern.js';
import type { FileSetExpectation, ForbiddenRule } from '../../types/expectations.js';
import type { PathRef } from '../../types/path-ref.js';
import { listMatchingFiles, normalizeFilePath } from './file-selection.js';
import { forbidden } from './forbidden.js';

export function createFileSetExpectation(root: string | PathRef): FileSetExpectation {
    return new FileSetExpectationImpl(pathToString(root), []);
}

class FileSetExpectationImpl implements FileSetExpectation {
    public readonly not = {
        toContainAny: async (patterns: Array<string | RegExp>): Promise<void> => {
            const files = await this.matchedFiles();

            for (const file of files) {
                const content = await readFile(file, 'utf8');
                const found = patterns.find((pattern) =>
                    matchesTextPattern(content, pattern));
                if (found) {
                    throw new SmokeError(`Expected files not to contain ${formatTextPattern(found)}.`, {
                        root: this.root,
                        file,
                        pattern: formatTextPattern(found),
                    });
                }
            }
        },
        toContainForbidden: async (rules: ForbiddenRule | ForbiddenRule[] = forbidden.defaults()): Promise<void> => {
            const files = await this.matchedFiles();
            const normalizedRules = Array.isArray(rules) ? rules : [rules];

            for (const file of files) {
                const relativePath = normalizeFilePath(relative(this.root, file));

                for (const rule of normalizedRules) {
                    const scope = rule.scope ?? 'content';
                    if (
                        (scope === 'path' || scope === 'both')
                        && matchesTextPattern(relativePath, rule.pattern)
                    ) {
                        throw new SmokeError(`Forbidden file matched rule "${rule.name}": ${relativePath}`, {
                            root: this.root,
                            file,
                            rule: rule.name,
                        });
                    }
                }

                const contentRules = normalizedRules.filter((rule) => (rule.scope ?? 'content') !== 'path');
                if (contentRules.length === 0) {
                    continue;
                }

                const content = await readFile(file, 'utf8');
                for (const rule of contentRules) {
                    const match = findForbiddenContent(content, rule.pattern);
                    if (match) {
                        throw new SmokeError(`Forbidden content matched rule "${rule.name}" in ${relativePath}:${String(match.line)}`, {
                            root: this.root,
                            file,
                            line: match.line,
                            rule: rule.name,
                        });
                    }
                }
            }
        },
    };

    constructor(
        private readonly root: string,
        private readonly patterns: string[],
    ) {}

    public matching(pattern: string | string[]): FileSetExpectation {
        return new FileSetExpectationImpl(this.root, [...this.patterns, ...Array.isArray(pattern) ? pattern : [pattern]]);
    }

    public async toContainAny(patterns: Array<string | RegExp>): Promise<void> {
        const files = await this.matchedFiles();

        for (const file of files) {
            const content = await readFile(file, 'utf8');
            const found = patterns.find((pattern) =>
                matchesTextPattern(content, pattern));
            if (found) {
                return;
            }
        }

        throw new SmokeError('Expected at least one matched file to contain one of the patterns.', {
            root: this.root,
            matchedFiles: files,
            patterns: patterns.map(formatTextPattern),
        });
    }

    private async matchedFiles(): Promise<string[]> {
        return listMatchingFiles(this.root, this.patterns);
    }
}

function findForbiddenContent(
    content: string,
    pattern: string | RegExp,
): { line: number } | undefined {
    const lines = content.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
        if (matchesTextPattern(lines[index] ?? '', pattern)) {
            return { line: index + 1 };
        }
    }

    return undefined;
}

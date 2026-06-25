import { readdir, readFile, stat } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

import { SmokeError } from '../../errors.js';
import { pathToString } from '../../path-ref.js';
import type { FileSetExpectation, ForbiddenRule, PathRef } from '../../types.js';
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
                const found = patterns.find((pattern) => matches(content, pattern));
                if (found) {
                    throw new SmokeError(`Expected files not to contain ${formatPattern(found)}.`, {
                        root: this.root,
                        file,
                        pattern: formatPattern(found),
                    });
                }
            }
        },
        toContainForbidden: async (rules: ForbiddenRule | ForbiddenRule[] = forbidden.defaults()): Promise<void> => {
            const files = await this.matchedFiles();
            const normalizedRules = Array.isArray(rules) ? rules : [rules];

            for (const file of files) {
                const relativePath = normalizePath(relative(this.root, file));

                for (const rule of normalizedRules) {
                    const scope = rule.scope ?? 'content';
                    if ((scope === 'path' || scope === 'both') && matches(relativePath, rule.pattern)) {
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
            const found = patterns.find((pattern) => matches(content, pattern));
            if (found) {
                return;
            }
        }

        throw new SmokeError('Expected at least one matched file to contain one of the patterns.', {
            root: this.root,
            matchedFiles: files,
            patterns: patterns.map(formatPattern),
        });
    }

    private async matchedFiles(): Promise<string[]> {
        const files = await listFiles(this.root);
        if (this.patterns.length === 0) {
            return files;
        }

        return files.filter((file) => {
            const rel = normalizePath(relative(this.root, file));
            return this.patterns.some((pattern) => globToRegExp(pattern).test(rel));
        });
    }
}

async function listFiles(root: string): Promise<string[]> {
    const entries = await readdir(root, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
        const path = resolve(root, entry.name);
        if (entry.isDirectory()) {
            files.push(...await listFiles(path));
        } else if (entry.isFile()) {
            files.push(path);
        } else if (entry.isSymbolicLink()) {
            const target = await stat(path);
            if (target.isFile()) {
                files.push(path);
            }
        }
    }

    return files.sort();
}

function matches(content: string, pattern: string | RegExp): boolean {
    if (typeof pattern === 'string') {
        return content.includes(pattern);
    }

    pattern.lastIndex = 0;
    return pattern.test(content);
}

function findForbiddenContent(
    content: string,
    pattern: string | RegExp,
): { line: number } | undefined {
    const lines = content.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
        if (matches(lines[index] ?? '', pattern)) {
            return { line: index + 1 };
        }
    }

    return undefined;
}

function globToRegExp(pattern: string): RegExp {
    const normalized = normalizePath(pattern);
    let source = '';

    for (let index = 0; index < normalized.length; index += 1) {
        const char = normalized[index];
        const next = normalized[index + 1];

        if (char === '*' && next === '*') {
            if (normalized[index + 2] === '/') {
                source += '(?:.*\\/)?';
                index += 2;
            } else {
                source += '.*';
                index += 1;
            }
        } else if (char === '*') {
            source += '[^/]*';
        } else if (char === '?') {
            source += '[^/]';
        } else {
            source += escapeRegExp(char ?? '');
        }
    }

    return new RegExp(`^${source}$`, 'u');
}

function normalizePath(path: string): string {
    return path.replace(/\\/gu, '/');
}

function formatPattern(pattern: string | RegExp): string {
    return typeof pattern === 'string' ? JSON.stringify(pattern) : String(pattern);
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

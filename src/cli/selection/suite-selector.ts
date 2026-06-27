import { relative, resolve } from 'node:path';

import type { SmokeSuite } from '../../types.js';
import { normalizePath } from '../path.js';

export interface SuiteSelectionOptions {
    pattern?: string;
    tags?: string[];
    skipTags?: string[];
}

export function selectSuites(
    suites: SmokeSuite[],
    repoRoot: string,
    options: SuiteSelectionOptions,
): SmokeSuite[] {
    const includeTags = normalizeTags(options.tags ?? []);
    const excludeTags = normalizeTags(options.skipTags ?? []);

    return suites.filter((suite) => {
        return matchesPattern(suite, repoRoot, options.pattern) && matchesTags(suite, includeTags, excludeTags);
    });
}

export function noSuiteMatchMessage(options: SuiteSelectionOptions): string {
    const hasPattern = options.pattern !== undefined;
    const hasTags = normalizeTags(options.tags ?? []).length > 0 || normalizeTags(options.skipTags ?? []).length > 0;

    if (hasPattern && hasTags) {
        return 'No smoke suites matched the selected pattern and tag filters.';
    }
    if (hasPattern) {
        return `No smoke suites matched: ${String(options.pattern)}`;
    }
    if (hasTags) {
        return 'No smoke suites matched the selected tag filters.';
    }
    return 'No smoke suites found.';
}

export function tagOnlySelectionOptions(options: SuiteSelectionOptions): SuiteSelectionOptions {
    const selection: SuiteSelectionOptions = {};
    if (options.tags !== undefined) {
        selection.tags = options.tags;
    }
    if (options.skipTags !== undefined) {
        selection.skipTags = options.skipTags;
    }
    return selection;
}

function matchesPattern(suite: SmokeSuite, repoRoot: string, pattern: string | undefined): boolean {
    if (!pattern) {
        return true;
    }

    if (suite.name.includes(pattern)) {
        return true;
    }

    if (!suite.file) {
        return false;
    }

    const normalizedPattern = normalizeRelativePattern(pattern);
    const absolutePattern = normalizePath(resolve(repoRoot, pattern));
    const normalizedFile = normalizePath(suite.file);
    const relativePath = normalizePath(relative(repoRoot, suite.file));
    return (
        normalizedFile === absolutePattern ||
        normalizedFile.startsWith(`${absolutePattern}/`) ||
        relativePath.includes(normalizedPattern) ||
        normalizedFile.endsWith(normalizePath(pattern))
    );
}

function matchesTags(suite: SmokeSuite, includeTags: string[], excludeTags: string[]): boolean {
    const suiteTags = new Set(suite.tags);
    const includes = includeTags.length === 0 || includeTags.some((tag) => suiteTags.has(tag));
    const excludes = excludeTags.some((tag) => suiteTags.has(tag));
    return includes && !excludes;
}

function normalizeTags(tags: string[]): string[] {
    return tags.map((tag) => tag.trim()).filter(Boolean);
}

function normalizeRelativePattern(pattern: string): string {
    return normalizePath(pattern).replace(/^\.\/+/u, '').replace(/\/+$/u, '');
}

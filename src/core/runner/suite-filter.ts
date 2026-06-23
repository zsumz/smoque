export interface SuiteFilterEntry {
    suite: {
        id: string;
        tags: string[];
    };
}

export interface SuiteFilterOptions {
    suiteIds?: string[];
    tags?: string[];
    skipTags?: string[];
}

export function filterSuites<T extends SuiteFilterEntry>(
    definitions: T[],
    options: SuiteFilterOptions,
): T[] {
    const includeIds = new Set(options.suiteIds ?? []);
    const includeTags = normalizeTags(options.tags ?? []);
    const excludeTags = normalizeTags(options.skipTags ?? []);

    return definitions.filter((definition) => {
        const suiteTags = new Set(definition.suite.tags);
        const matchesId = includeIds.size === 0 || includeIds.has(definition.suite.id);
        const includes = includeTags.length === 0 || includeTags.some((tag) => suiteTags.has(tag));
        const excludes = excludeTags.some((tag) => suiteTags.has(tag));
        return matchesId && includes && !excludes;
    });
}

function normalizeTags(tags: string[]): string[] {
    return tags.map((tag) => tag.trim()).filter(Boolean);
}

import type { DurationString } from '../../types/duration.js';
import { parseCliOptions, type CliOption } from './option-parser.js';

export interface RunCliOptions {
    pattern?: string;
    json?: string;
    junit?: string;
    ci?: boolean;
    keepWorkdirOnFail?: boolean;
    tags?: string[];
    skipTags?: string[];
    updateSnapshots?: boolean;
}

export interface ListCliOptions {
    pattern?: string;
    tags?: string[];
    skipTags?: string[];
}

export interface SnippetCliOptions {
    pattern?: string;
    timeout?: DurationString;
}

export function parseRunOptions(args: string[]): RunCliOptions {
    return parseCliOptions('run', args, {}, runOptions);
}

export function parseListOptions(args: string[]): ListCliOptions {
    return parseCliOptions('list', args, {}, listOptions);
}

export function parseSnippetOptions(args: string[]): SnippetCliOptions {
    return parseCliOptions('snippets', args, {}, snippetOptions);
}

const runOptions: Readonly<Record<string, CliOption<RunCliOptions>>> = {
    json: stringOption('--json requires a value.', (options, value) => {
        options.json = value;
    }),
    junit: stringOption('--junit requires a value.', (options, value) => {
        options.junit = value;
    }),
    'keep-workdir-on-fail': booleanOption((options) => {
        options.keepWorkdirOnFail = true;
    }),
    ci: booleanOption((options) => {
        options.ci = true;
        options.keepWorkdirOnFail = true;
    }),
    tag: tagOption('--tag', 'tags'),
    'skip-tag': tagOption('--skip-tag', 'skipTags'),
    'update-snapshots': booleanOption((options) => {
        options.updateSnapshots = true;
    }),
};

const listOptions: Readonly<Record<string, CliOption<ListCliOptions>>> = {
    tag: tagOption('--tag', 'tags'),
    'skip-tag': tagOption('--skip-tag', 'skipTags'),
};

const snippetOptions: Readonly<Record<string, CliOption<SnippetCliOptions>>> = {
    timeout: stringOption('--timeout requires a value.', (options, value) => {
        options.timeout = value as DurationString;
    }),
};

function readTags(value: string, name: string): string[] {
    const tags = value.split(',').map((tag) => tag.trim()).filter(Boolean);
    if (tags.length === 0) {
        throw new Error(`${name} requires at least one tag.`);
    }

    return tags;
}

function booleanOption<T extends { pattern?: string }>(
    apply: (options: T) => void,
): CliOption<T> {
    return { type: 'boolean', apply };
}

function stringOption<T extends { pattern?: string }>(
    missingValueMessage: string,
    apply: (options: T, value: string) => void,
): CliOption<T> {
    return { type: 'string', missingValueMessage, apply };
}

function tagOption<T extends RunCliOptions | ListCliOptions>(
    name: string,
    key: 'tags' | 'skipTags',
): CliOption<T> {
    return stringOption(`${name} requires a tag.`, (options, value) => {
        options[key] = [...options[key] ?? [], ...readTags(value, name)];
    });
}

import type { DurationString } from '../../types.js';

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
    const options: RunCliOptions = {};

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index] ?? '';
        if (arg === '--json') {
            options.json = readOptionValue(args, index += 1, '--json');
        } else if (arg === '--junit') {
            options.junit = readOptionValue(args, index += 1, '--junit');
        } else if (arg === '--keep-workdir-on-fail') {
            options.keepWorkdirOnFail = true;
        } else if (arg === '--ci') {
            options.ci = true;
            options.keepWorkdirOnFail = true;
        } else if (arg === '--tag') {
            options.tags = [...options.tags ?? [], ...readTags(args, index += 1, '--tag')];
        } else if (arg === '--skip-tag') {
            options.skipTags = [...options.skipTags ?? [], ...readTags(args, index += 1, '--skip-tag')];
        } else if (arg === '--update-snapshots') {
            options.updateSnapshots = true;
        } else if (arg.startsWith('-')) {
            throw new Error(`Unknown smoque run option: ${arg}`);
        } else if (arg && options.pattern === undefined) {
            options.pattern = arg;
        } else {
            throw new Error(`Unexpected smoque run argument: ${arg}`);
        }
    }

    return options;
}

export function parseListOptions(args: string[]): ListCliOptions {
    const options: ListCliOptions = {};

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index] ?? '';
        if (arg === '--tag') {
            options.tags = [...options.tags ?? [], ...readTags(args, index += 1, '--tag')];
        } else if (arg === '--skip-tag') {
            options.skipTags = [...options.skipTags ?? [], ...readTags(args, index += 1, '--skip-tag')];
        } else if (arg.startsWith('-')) {
            throw new Error(`Unknown smoque list option: ${arg}`);
        } else if (arg && options.pattern === undefined) {
            options.pattern = arg;
        } else {
            throw new Error(`Unexpected smoque list argument: ${arg}`);
        }
    }

    return options;
}

export function parseSnippetOptions(args: string[]): SnippetCliOptions {
    const options: SnippetCliOptions = {};

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index] ?? '';
        if (arg === '--timeout') {
            options.timeout = readOptionValue(args, index += 1, '--timeout') as DurationString;
        } else if (arg.startsWith('-')) {
            throw new Error(`Unknown smoque snippets option: ${arg}`);
        } else if (options.pattern === undefined) {
            options.pattern = arg;
        } else {
            throw new Error(`Unexpected smoque snippets argument: ${arg}`);
        }
    }

    return options;
}

function readTags(args: string[], index: number, name: string): string[] {
    const value = args[index];
    if (!value || value.startsWith('-')) {
        throw new Error(`${name} requires a tag.`);
    }

    const tags = value.split(',').map((tag) => tag.trim()).filter(Boolean);
    if (tags.length === 0) {
        throw new Error(`${name} requires at least one tag.`);
    }

    return tags;
}

function readOptionValue(args: string[], index: number, name: string): string {
    const value = args[index];
    if (!value || value.startsWith('-')) {
        throw new Error(`${name} requires a value.`);
    }
    return value;
}

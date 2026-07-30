import {
    parseArgs,
    type ParseArgsOptionsConfig,
} from 'node:util';

interface CliOptions {
    pattern?: string;
}

export type CliOption<T extends CliOptions> =
    | {
        type: 'boolean';
        apply(options: T): void;
    }
    | {
        type: 'string';
        missingValueMessage: string;
        apply(options: T, value: string): void;
    };

type CliOptionMap<T extends CliOptions> = Readonly<Record<string, CliOption<T>>>;

export interface CliPositionalPolicy {
    allowEmptyPattern?: boolean;
}

export function parseCliOptions<T extends CliOptions>(
    command: string,
    args: string[],
    options: T,
    optionMap: CliOptionMap<T>,
    positionalPolicy: CliPositionalPolicy = {},
): T {
    const tokens = parseArgs({
        args,
        options: parserOptions(optionMap),
        strict: false,
        allowPositionals: true,
        tokens: true,
    }).tokens;

    for (const token of tokens) {
        if (token.kind === 'positional') {
            assignPattern(
                command,
                args,
                options,
                token.index,
                token.value,
                positionalPolicy,
            );
            continue;
        }
        if (token.kind === 'option-terminator') {
            throw unknownOption(command, args, token.index);
        }

        const option = optionMap[token.name];
        if (option === undefined || token.inlineValue === true) {
            throw unknownOption(command, args, token.index);
        }
        if (option.type === 'boolean') {
            option.apply(options);
            continue;
        }
        option.apply(
            options,
            requiredOptionValue(token.value, option.missingValueMessage),
        );
    }
    return options;
}

function parserOptions<T extends CliOptions>(
    optionMap: CliOptionMap<T>,
): ParseArgsOptionsConfig {
    return Object.fromEntries(
        Object.entries(optionMap).map(([name, option]) => [
            name,
            { type: option.type },
        ]),
    );
}

function assignPattern(
    command: string,
    args: string[],
    options: CliOptions,
    index: number,
    value: string,
    positionalPolicy: CliPositionalPolicy,
): void {
    if (value.startsWith('-')) {
        throw unknownOption(command, args, index);
    }
    if (
        (value || positionalPolicy.allowEmptyPattern === true) &&
        options.pattern === undefined
    ) {
        options.pattern = value;
        return;
    }
    throw new Error(`Unexpected smoque ${command} argument: ${value}`);
}

function requiredOptionValue(
    value: string | undefined,
    missingValueMessage: string,
): string {
    if (!value || value.startsWith('-')) {
        throw new Error(missingValueMessage);
    }
    return value;
}

function unknownOption(command: string, args: string[], index: number): Error {
    return new Error(`Unknown smoque ${command} option: ${args[index] ?? ''}`);
}

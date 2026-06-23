import { fileURLToPath } from 'node:url';

export function inferCallerFile(): string | undefined {
    const callSiteFile = inferCallerFileFromCallSites();
    if (callSiteFile) {
        return callSiteFile;
    }

    const stack = new Error().stack?.split('\n').slice(1) ?? [];
    for (const line of stack) {
        const file = extractStackFile(line);
        if (!file || isInternalSuiteFrame(file)) {
            continue;
        }
        return file;
    }
    return undefined;
}

function inferCallerFileFromCallSites(): string | undefined {
    const previousStackTrace = Object.getOwnPropertyDescriptor(Error, 'prepareStackTrace')
        ?.value as typeof Error.prepareStackTrace;
    try {
        Error.prepareStackTrace = (_error, stack) => stack;
        const stack = new Error().stack as unknown;
        if (!Array.isArray(stack)) {
            return undefined;
        }

        for (const callSite of stack) {
            if (!isStackCallSite(callSite)) {
                continue;
            }
            const rawFile = callSite.getFileName();
            if (!rawFile) {
                continue;
            }
            const file = normalizeStackFile(rawFile);
            if (isInternalSuiteFrame(file)) {
                continue;
            }
            return file;
        }
        return undefined;
    } finally {
        Error.prepareStackTrace = previousStackTrace;
    }
}

interface StackCallSite {
    getFileName(): string | null;
}

function isStackCallSite(value: unknown): value is StackCallSite {
    return typeof value === 'object' && value !== null && 'getFileName' in value;
}

export function extractStackFile(line: string): string | undefined {
    const match = /(?:\()?(file:\/\/[^:)]+|\/[^:)]+):\d+:\d+\)?$/u.exec(line.trim());
    const raw = match?.[1];
    if (!raw) {
        return undefined;
    }
    return raw.startsWith('file://') ? fileURLToPath(raw) : raw;
}

export function normalizeStackFile(file: string): string {
    return file.startsWith('file:') ? fileURLToPath(file) : file;
}

function isInternalSuiteFrame(file: string): boolean {
    return /\/(?:(?:node_modules\/smoque)\/)?(?:src|dist)\/(?:core(?:\/.*)?|index)\.(?:ts|js)$/u.test(file);
}

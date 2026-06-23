import type { LogApi, LogContainsOptions, Probe, ProcessHandle } from './types.js';

export function createLogApi(write: (message: string) => Promise<void> | void): LogApi {
    const log = (async (message: string) => write(message)) as LogApi;

    log.contains = (pattern: string | RegExp, options: LogContainsOptions = {}): Probe => {
        const stream = options.stream ?? 'both';
        return {
            description: `process log ${stream} contains ${formatPattern(pattern)}`,
            async check(process) {
                if (!process) {
                    return Promise.resolve({
                        ready: false,
                        message: 'process handle is not available',
                    });
                }

                const text = readProcessLog(process, stream);
                return Promise.resolve({
                    ready: matches(text, pattern),
                    message: `captured ${String(text.length)} characters`,
                });
            },
        };
    };

    return log;
}

function readProcessLog(process: ProcessHandle, stream: 'stdout' | 'stderr' | 'both'): string {
    switch (stream) {
        case 'stdout':
            return process.stdout();
        case 'stderr':
            return process.stderr();
        case 'both':
            return `${process.stdout()}\n${process.stderr()}`;
    }
}

function matches(value: string, pattern: string | RegExp): boolean {
    return typeof pattern === 'string' ? value.includes(pattern) : pattern.test(value);
}

function formatPattern(pattern: string | RegExp): string {
    return typeof pattern === 'string' ? JSON.stringify(pattern) : String(pattern);
}

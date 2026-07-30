import {
    formatTextPattern,
    matchesTextPattern,
} from './shared/text-pattern.js';
import type { LogApi, LogContainsOptions } from './types/log.js';
import type { Probe } from './types/probe.js';
import type { ProcessHandle } from './types/process.js';

export function createLogApi(write: (message: string) => Promise<void> | void): LogApi {
    const log = (async (message: string) => write(message)) as LogApi;

    log.contains = (pattern: string | RegExp, options: LogContainsOptions = {}): Probe => {
        const stream = options.stream ?? 'both';
        return {
            description: `process log ${stream} contains ${formatTextPattern(pattern)}`,
            async check(process) {
                if (!process) {
                    return Promise.resolve({
                        ready: false,
                        message: 'process handle is not available',
                    });
                }

                const text = readProcessLog(process, stream);
                return Promise.resolve({
                    ready: matchesTextPattern(text, pattern),
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

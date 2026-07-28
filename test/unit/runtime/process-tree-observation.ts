import { ChildProcess } from 'node:child_process';

interface FakeChildOptions {
    pid?: number | undefined;
    exitCode?: number | null;
    signalCode?: NodeJS.Signals | null;
}

export interface ObservedChild {
    child: ChildProcess;
    signals: Array<NodeJS.Signals | number>;
}

export type ProcessKill = (pid: number, signal?: string | number) => true;

export function createObservedChild(options: FakeChildOptions = {}): ObservedChild {
    const child = new ChildProcess();
    const signals: Array<NodeJS.Signals | number> = [];

    Object.defineProperties(child, {
        pid: {
            configurable: true,
            value: options.pid,
            writable: true,
        },
        exitCode: {
            configurable: true,
            value: options.exitCode ?? null,
            writable: true,
        },
        signalCode: {
            configurable: true,
            value: options.signalCode ?? null,
            writable: true,
        },
    });
    child.kill = (signal: NodeJS.Signals | number = 'SIGTERM') => {
        signals.push(signal);
        return true;
    };

    return { child, signals };
}

export function withProcessKill<T>(replacement: ProcessKill, callback: () => T): T {
    const original = process.kill.bind(process);
    process.kill = replacement;

    try {
        return callback();
    } finally {
        process.kill = original;
    }
}

export function withPlatform<T>(platform: NodeJS.Platform, callback: () => T): T {
    const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
    if (descriptor === undefined) {
        throw new Error('Expected process.platform to have a property descriptor');
    }

    Object.defineProperty(process, 'platform', {
        configurable: true,
        enumerable: descriptor.enumerable ?? false,
        value: platform,
    });

    try {
        return callback();
    } finally {
        Object.defineProperty(process, 'platform', descriptor);
    }
}

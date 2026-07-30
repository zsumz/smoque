import assert from 'node:assert/strict';

import {
    createGitHubReporter,
    createJsonReporter,
    createJUnitReporter,
    createTerminalReporter,
} from '../../../dist/core.js';
import type { SmokeEvent, SmokeEventSink } from '../../../dist/core.js';
import { escapeRegExp } from '../../../dist/shared/text-pattern.js';

export { escapeRegExp } from '../../../dist/shared/text-pattern.js';

interface CapturedReporters {
    readonly github: string;
    readonly json: string;
    readonly junit: string;
    readonly reporter: SmokeEventSink;
    readonly terminal: string;
    values(): string[];
}

export function captureReporters(): CapturedReporters {
    let terminal = '';
    let json = '';
    let junit = '';
    let github = '';
    const reporters = [
        createTerminalReporter({
            write(text) {
                terminal += text;
            },
        }),
        createJsonReporter({
            write(text) {
                json += text;
            },
        }),
        createJUnitReporter({
            write(text) {
                junit += text;
            },
        }),
        createGitHubReporter({
            write(text) {
                github += text;
            },
        }),
    ];

    return {
        get terminal() {
            return terminal;
        },
        get json() {
            return json;
        },
        get junit() {
            return junit;
        },
        get github() {
            return github;
        },
        values: () => [terminal, json, junit, github],
        reporter: {
            async emit(event: SmokeEvent): Promise<void> {
                await Promise.all(reporters.map(async (reporter) => reporter.emit(event)));
            },
        },
    };
}

export function assertAllRedacted(values: readonly string[], secret: string): void {
    const secretPattern = new RegExp(escapeRegExp(secret), 'u');
    for (const value of values) {
        assert.doesNotMatch(value, secretPattern);
    }
}

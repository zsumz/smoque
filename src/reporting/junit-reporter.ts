import { writeFile } from 'node:fs/promises';

import type { SmokeEvent, SmokeEventSink, SerializedSmokeError } from '../events.js';
import { pathToString } from '../path-ref.js';
import type { PathRef } from '../types.js';
import {
    EventReportBuilder,
    type JsonLogReport,
    type JsonSmokeReport,
    type JsonSuiteReport,
} from './event-report-builder.js';
import { escapeXml, indentXml, seconds } from './format/junit.js';

export interface JUnitReporterOptions {
    path?: string | PathRef;
    write?: (text: string) => Promise<void> | void;
}

export interface JUnitReporter extends SmokeEventSink {
    finish(): Promise<void>;
}

export function createJUnitReporter(options: JUnitReporterOptions = {}): JUnitReporter {
    return new JUnitReporterImpl(options);
}

class JUnitReporterImpl implements JUnitReporter {
    private readonly reportBuilder = new EventReportBuilder();
    private finished = false;

    constructor(private readonly options: JUnitReporterOptions) {}

    public async emit(event: SmokeEvent): Promise<void> {
        this.reportBuilder.apply(event);
        if (event.type === 'run.finished') {
            await this.finish();
        }
    }

    public async finish(): Promise<void> {
        if (this.finished) {
            return;
        }

        this.finished = true;
        const xml = renderJUnit(this.reportBuilder.report());
        if (this.options.write) {
            await this.options.write(xml);
            return;
        }
        if (this.options.path) {
            await writeFile(pathToString(this.options.path), xml, 'utf8');
            return;
        }
        process.stdout.write(xml);
    }
}

function renderJUnit(report: JsonSmokeReport): string {
    const suites = report.suites.map(renderJUnitSuite);
    const tests = report.suites.reduce((count, suite) => count + testCasesForSuite(suite).length, 0);
    const failures = report.suites.reduce(
        (count, suite) =>
            count + testCasesForSuite(suite).filter((testCase) => testCase.status === 'failed').length,
        0,
    );
    const skipped = report.suites.reduce(
        (count, suite) =>
            count + testCasesForSuite(suite).filter((testCase) => testCase.status === 'skipped').length,
        0,
    );

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<testsuites name="smoque" tests="${String(tests)}" failures="${String(failures)}" skipped="${String(skipped)}" time="${seconds(report.run.durationMs ?? 0)}">`,
        ...suites.map((suite) => indentXml(suite)),
        '</testsuites>',
        '',
    ].join('\n');
}

function renderJUnitSuite(suite: JsonSuiteReport): string {
    const testCases = testCasesForSuite(suite);
    const failures = testCases.filter((testCase) => testCase.status === 'failed').length;
    const skipped = testCases.filter((testCase) => testCase.status === 'skipped').length;

    return [
        `<testsuite name="${escapeXml(suite.name)}" tests="${String(testCases.length)}" failures="${String(failures)}" skipped="${String(skipped)}" time="${seconds(suite.durationMs ?? 0)}">`,
        ...testCases.map((testCase) => indentXml(renderJUnitCase(testCase))),
        '</testsuite>',
    ].join('\n');
}

interface JUnitTestCase {
    name: string;
    className: string;
    status: 'passed' | 'failed' | 'skipped';
    durationMs: number;
    error?: SerializedSmokeError;
    skipReason?: string;
    stdout?: string;
    stderr?: string;
}

function testCasesForSuite(suite: JsonSuiteReport): JUnitTestCase[] {
    if (suite.steps.length === 0) {
        return [
            {
                name: suite.name,
                className: suite.name,
                status:
          suite.status === 'skipped' ? 'skipped' : suite.status === 'failed' ? 'failed' : 'passed',
                durationMs: suite.durationMs ?? 0,
                stdout: renderLogs(suite.logs),
            },
        ];
    }

    return suite.steps.map((step) => {
        const testCase: JUnitTestCase = {
            name: step.name,
            className: suite.name,
            status: step.status === 'failed' ? 'failed' : step.status === 'skipped' ? 'skipped' : 'passed',
            durationMs: step.durationMs ?? 0,
        };
        const stdout = [
            renderLogs(step.logs),
            step.commands
                .map((command) => command.stdout)
                .filter(Boolean)
                .join('\n'),
        ]
            .filter(Boolean)
            .join('\n');
        const stderr = step.commands
            .map((command) => command.stderr)
            .filter(Boolean)
            .join('\n');

        if (step.error) {
            testCase.error = step.error;
        }
        if (step.skipReason) {
            testCase.skipReason = step.skipReason;
        }
        if (stdout) {
            testCase.stdout = stdout;
        }
        if (stderr) {
            testCase.stderr = stderr;
        }

        return testCase;
    });
}

function renderLogs(logs: JsonLogReport[]): string {
    return logs.map((log) => log.message).filter(Boolean).join('\n');
}

function renderJUnitCase(testCase: JUnitTestCase): string {
    const open = `<testcase classname="${escapeXml(testCase.className)}" name="${escapeXml(testCase.name)}" time="${seconds(testCase.durationMs)}">`;
    const children: string[] = [];

    if (testCase.status === 'skipped') {
        const message = testCase.skipReason ? ` message="${escapeXml(testCase.skipReason)}"` : '';
        children.push(`<skipped${message} />`);
    }
    if (testCase.status === 'failed') {
        const message = testCase.error?.message ?? 'Suite failed.';
        const type = testCase.error?.name ?? 'Error';
        children.push(
            `<failure message="${escapeXml(message)}" type="${escapeXml(type)}">${escapeXml(testCase.error?.stack ?? message)}</failure>`,
        );
    }
    if (testCase.stdout) {
        children.push(`<system-out>${escapeXml(testCase.stdout)}</system-out>`);
    }
    if (testCase.stderr) {
        children.push(`<system-err>${escapeXml(testCase.stderr)}</system-err>`);
    }

    if (children.length === 0) {
        return open.replace(/>$/u, ' />');
    }

    return [open, ...children.map(indentXml), '</testcase>'].join('\n');
}

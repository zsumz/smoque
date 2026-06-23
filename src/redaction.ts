import type { SerializedSmokeError, SmokeEvent } from './events.js';
import type { RedactOptions } from './types.js';

interface RedactionRule {
    pattern: string | RegExp;
    replacement: string;
}

export class Redactor {
    private readonly rules: RedactionRule[] = [];

    public add(value: string | RegExp | undefined | null, options: RedactOptions = {}): void {
        if (value === undefined || value === null || value === '') {
            return;
        }

        this.rules.push({
            pattern: value,
            replacement: options.replacement ?? '[redacted]',
        });
    }

    public text(value: string): string {
        let redacted = value;

        for (const rule of this.rules) {
            redacted =
                typeof rule.pattern === 'string'
                    ? redacted.split(rule.pattern).join(rule.replacement)
                    : redacted.replace(toGlobalPattern(rule.pattern), rule.replacement);
        }

        return redacted;
    }

    public value(value: unknown): unknown {
        if (typeof value === 'string') {
            return this.text(value);
        }
        if (Array.isArray(value)) {
            return value.map((item) => this.value(item));
        }
        if (isPlainObject(value)) {
            const redacted: Record<string, unknown> = {};
            for (const [key, item] of Object.entries(value)) {
                redacted[key] = this.value(item);
            }
            return redacted;
        }

        return value;
    }

    public error(error: SerializedSmokeError): SerializedSmokeError {
        const redacted: SerializedSmokeError = {
            name: this.text(error.name),
            message: this.text(error.message),
        };

        if (error.stack !== undefined) {
            redacted.stack = this.text(error.stack);
        }
        if (error.details !== undefined) {
            redacted.details = this.value(error.details) as Record<string, unknown>;
        }

        return redacted;
    }

    public event(event: SmokeEvent): SmokeEvent {
        switch (event.type) {
            case 'run.started':
            case 'run.finished':
            case 'command.finished':
            case 'step.passed':
            case 'suite.finished':
                return { ...event };
            case 'suite.discovered':
                return {
                    ...event,
                    name: this.text(event.name),
                    file: this.text(event.file),
                    tags: event.tags.map((tag) => this.text(tag)),
                };
            case 'suite.started':
                return { ...event, name: this.text(event.name) };
            case 'step.started':
                return { ...event, name: this.text(event.name) };
            case 'step.skipped':
                return { ...event, reason: this.text(event.reason) };
            case 'command.started':
                return {
                    ...event,
                    command: this.text(event.command),
                    args: event.args.map((arg) => this.text(arg)),
                    cwd: this.text(event.cwd),
                };
            case 'command.output':
                return { ...event, text: this.text(event.text) };
            case 'log.message':
                return { ...event, message: this.text(event.message) };
            case 'artifact.attached':
                return {
                    ...event,
                    name: this.text(event.name),
                    path: this.text(event.path),
                    kind: this.text(event.kind),
                };
            case 'step.failed':
                return { ...event, error: this.error(event.error) };
        }
    }
}

function toGlobalPattern(pattern: RegExp): RegExp {
    if (pattern.global) {
        return pattern;
    }

    return new RegExp(pattern.source, `${pattern.flags}g`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const prototype: unknown = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

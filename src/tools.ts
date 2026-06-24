import { spawn } from 'node:child_process';

import { SmokeError } from './errors.js';
import type { ToolDiscovery, ToolRef, ToolVersionOptions } from './types.js';

interface ToolSpec {
    name: string;
    command: string;
    args: string[];
    path?: string;
}

export function createToolDiscovery(): ToolDiscovery {
    return {
        node: async (options) =>
            discoverTool({
                name: 'node',
                command: process.execPath,
                args: ['--version'],
                path: process.execPath,
            }, options),
        npm: async (options) => discoverTool({ name: 'npm', command: 'npm', args: ['--version'] }, options),
        java: async (options) => discoverTool({ name: 'java', command: 'java', args: ['-version'] }, options),
        jar: async (options) => discoverTool({ name: 'jar', command: 'jar', args: ['--version'] }, options),
        docker: async (options) => discoverTool({ name: 'docker', command: 'docker', args: ['--version'] }, options),
    };
}

async function discoverTool(spec: ToolSpec, options: ToolVersionOptions = {}): Promise<ToolRef> {
    const required = options.required ?? true;
    const result = await run(spec.command, spec.args);

    if (result.exitCode !== 0) {
        if (!required) {
            return { command: spec.command };
        }

        throw new SmokeError(`Required tool not found: ${spec.name}`, {
            tool: spec.name,
            command: spec.command,
            stderr: result.stderr,
            stdout: result.stdout,
        });
    }

    const versionOutput = `${result.stdout}\n${result.stderr}`.trim();
    const version = parseVersion(versionOutput);
    if (options.minVersion !== undefined && version && compareVersions(version, String(options.minVersion)) < 0) {
        throw new SmokeError(`Tool ${spec.name} version ${version} is below required ${String(options.minVersion)}.`, {
            tool: spec.name,
            command: spec.command,
            version,
            minVersion: String(options.minVersion),
        });
    }

    const ref: ToolRef = {
        command: spec.command,
    };
    if (version !== undefined) {
        ref.version = version;
    }
    const path = spec.path ?? await resolveExecutable(spec.command);
    if (path !== undefined) {
        ref.path = path;
    }

    return ref;
}

function parseVersion(output: string): string | undefined {
    return /\d+(?:\.\d+){0,2}/u.exec(output)?.[0];
}

function compareVersions(actual: string, minimum: string): number {
    const actualParts = versionParts(actual);
    const minimumParts = versionParts(minimum);

    for (let index = 0; index < Math.max(actualParts.length, minimumParts.length); index += 1) {
        const actualPart = actualParts[index] ?? 0;
        const minimumPart = minimumParts[index] ?? 0;
        if (actualPart > minimumPart) {
            return 1;
        }
        if (actualPart < minimumPart) {
            return -1;
        }
    }

    return 0;
}

function versionParts(version: string): number[] {
    return version.split('.').map((part) => Number.parseInt(part, 10) || 0);
}

async function resolveExecutable(command: string): Promise<string | undefined> {
    const result =
        process.platform === 'win32'
            ? await run('where', [command])
            : await run('sh', ['-c', `command -v ${shellQuote(command)}`]);

    if (result.exitCode !== 0) {
        return undefined;
    }

    return result.stdout.split(/\r?\n/u).find(Boolean);
}

function shellQuote(value: string): string {
    return `'${value.replace(/'/gu, '\'\\\'\'')}'`;
}

async function run(command: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
        const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        let resolved = false;

        const finish = (result: { exitCode: number; stdout: string; stderr: string }): void => {
            if (resolved) {
                return;
            }
            resolved = true;
            resolve(result);
        };

        child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
        child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
        child.on('error', (error) => {
            finish({ exitCode: 1, stdout: '', stderr: error.message });
        });
        child.on('close', (exitCode) => {
            finish({
                exitCode: exitCode ?? 0,
                stdout: Buffer.concat(stdout).toString('utf8'),
                stderr: Buffer.concat(stderr).toString('utf8'),
            });
        });
    });
}

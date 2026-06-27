import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { isNotFoundError } from '../../shared/fs.js';
import { discoverSmokeFiles } from '../discovery/smoke-files.js';
import { runProcess } from '../process.js';

interface DoctorCheck {
    status: 'ok' | 'warn' | 'fail';
    name: string;
    message: string;
}

interface NodeVersion {
    major: number;
    minor: number;
    patch: number;
}

const minimumTypeScriptRuntime = { major: 22, minor: 18, patch: 0 };
const minimumTypeScriptRuntimeLabel = '>=22.18';

export async function doctorCommand(args: string[]): Promise<number> {
    if (args.length > 0) {
        throw new Error(`Unexpected smoque doctor argument: ${String(args[0])}`);
    }

    const repoRoot = process.cwd();
    const checks: DoctorCheck[] = [];

    checks.push({ status: 'ok', name: 'node', message: process.version });
    checks.push(checkTypeScriptRuntime());
    checks.push(await checkNpm());
    checks.push(await checkPackageJson(repoRoot));
    checks.push(await checkSmokeFiles(repoRoot));
    checks.push(await checkAgentsFile(repoRoot));

    console.log('smoque doctor');
    for (const check of checks) {
        console.log(`${doctorStatusLabel(check.status)} ${check.name}: ${check.message}`);
    }

    return checks.some((check) => check.status === 'fail') ? 1 : 0;
}

async function checkNpm(): Promise<DoctorCheck> {
    const result = await runProcess('npm', ['--version']);
    if (result.exitCode === 0) {
        return { status: 'ok', name: 'npm', message: result.stdout.trim() };
    }

    return {
        status: 'fail',
        name: 'npm',
        message: result.stderr.trim() || result.stdout.trim() || 'npm --version failed.',
    };
}

function checkTypeScriptRuntime(): DoctorCheck {
    const features = process.features as NodeJS.ProcessFeatures & { typescript?: string };
    const version = parseNodeVersion(process.version);

    if (version === undefined) {
        return {
            status: 'fail',
            name: 'typescript smoke files',
            message: `could not parse Node version ${process.version}; requires Node ${minimumTypeScriptRuntimeLabel}.`,
        };
    }

    if (compareNodeVersions(version, minimumTypeScriptRuntime) < 0) {
        return {
            status: 'fail',
            name: 'typescript smoke files',
            message: `requires Node ${minimumTypeScriptRuntimeLabel}; current ${process.version}. Use .smoke.mjs for plain JavaScript smoke files.`,
        };
    }

    const typescriptSupport = typeof features.typescript === 'string' ? features.typescript : undefined;
    if (typescriptSupport !== undefined) {
        return {
            status: 'ok',
            name: 'typescript smoke files',
            message: `native ${typescriptSupport} support on ${process.version}; .smoke.ts must use erasable TypeScript.`,
        };
    }

    return {
        status: 'fail',
        name: 'typescript smoke files',
        message: `native TypeScript stripping is unavailable on ${process.version}; requires Node ${minimumTypeScriptRuntimeLabel}.`,
    };
}

function parseNodeVersion(version: string): NodeVersion | undefined {
    const match = /^v?(\d+)\.(\d+)\.(\d+)/u.exec(version);
    if (match === null) {
        return undefined;
    }

    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
    };
}

function compareNodeVersions(left: NodeVersion, right: NodeVersion): number {
    if (left.major !== right.major) {
        return left.major - right.major;
    }
    if (left.minor !== right.minor) {
        return left.minor - right.minor;
    }
    return left.patch - right.patch;
}

async function checkPackageJson(repoRoot: string): Promise<DoctorCheck> {
    const packageJsonPath = resolve(repoRoot, 'package.json');
    try {
        const raw = await readFile(packageJsonPath, 'utf8');
        const parsed = JSON.parse(raw) as { name?: unknown };
        const name =
            typeof parsed.name === 'string' && parsed.name.length > 0 ? parsed.name : 'unnamed package';
        return { status: 'ok', name: 'package.json', message: `found ${name}` };
    } catch (error) {
        if (isNotFoundError(error)) {
            return {
                status: 'warn',
                name: 'package.json',
                message:
          'not found; install smoque in this project before running scaffolded smoke files.',
            };
        }

        if (error instanceof SyntaxError) {
            return { status: 'fail', name: 'package.json', message: 'invalid JSON.' };
        }

        throw error;
    }
}

async function checkSmokeFiles(repoRoot: string): Promise<DoctorCheck> {
    const files = await discoverSmokeFiles(repoRoot, undefined);
    if (files.length === 0) {
        return {
            status: 'warn',
            name: 'smoke files',
            message: 'none found; run smoque init to create one.',
        };
    }

    return {
        status: 'ok',
        name: 'smoke files',
        message: `${String(files.length)} found.`,
    };
}

async function checkAgentsFile(repoRoot: string): Promise<DoctorCheck> {
    try {
        await readFile(resolve(repoRoot, 'smoke', 'AGENTS.md'), 'utf8');
        return { status: 'ok', name: 'smoke/AGENTS.md', message: 'found.' };
    } catch (error) {
        if (isNotFoundError(error)) {
            return {
                status: 'warn',
                name: 'smoke/AGENTS.md',
                message: 'not found; run smoque agents init to add smoke-test conventions.',
            };
        }
        throw error;
    }
}

function doctorStatusLabel(status: DoctorCheck['status']): string {
    if (status === 'ok') {
        return 'OK  ';
    }
    if (status === 'warn') {
        return 'WARN';
    }
    return 'FAIL';
}

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { isNotFoundError } from '../../shared/fs.js';
import { discoverSmokeFiles } from '../discovery/smoke-files.js';
import { runProcess } from '../process.js';
import type { DoctorCheck } from './doctor-check.js';

export async function checkNpm(): Promise<DoctorCheck> {
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

export async function checkPackageJson(repoRoot: string): Promise<DoctorCheck> {
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

export async function checkSmokeFiles(repoRoot: string): Promise<DoctorCheck> {
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

export async function checkAgentsFile(repoRoot: string): Promise<DoctorCheck> {
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

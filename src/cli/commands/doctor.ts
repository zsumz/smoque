import { doctorStatusLabel, type DoctorCheck } from './doctor-check.js';
import {
    checkAgentsFile,
    checkNpm,
    checkPackageJson,
    checkSmokeFiles,
} from './project-doctor-checks.js';
import { checkTypeScriptRuntime } from './typescript-runtime-check.js';

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

import type { DoctorCheck } from './doctor-check.js';

interface NodeVersion {
    major: number;
    minor: number;
    patch: number;
}

const minimumTypeScriptRuntime = { major: 22, minor: 18, patch: 0 };
const minimumTypeScriptRuntimeLabel = '>=22.18';

export function checkTypeScriptRuntime(): DoctorCheck {
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

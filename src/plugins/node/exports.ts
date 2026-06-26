import { isRecord } from './package-json.js';

export function normalizeSubpaths(input: string | string[]): string[] {
    return (Array.isArray(input) ? input : [input]).map((subpath) => subpath.trim()).map(normalizeSubpath).filter(Boolean);
}

export function getExportEntry(packageJson: Record<string, unknown>, subpath: string): unknown {
    const exportsValue = packageJson.exports;
    if (exportsValue === undefined) {
        return undefined;
    }

    if (subpath === '.' && (typeof exportsValue === 'string' || Array.isArray(exportsValue))) {
        return exportsValue;
    }

    if (!isRecord(exportsValue)) {
        return undefined;
    }

    if (subpath in exportsValue) {
        return exportsValue[subpath];
    }

    if (subpath === '.' && !Object.keys(exportsValue).some((key) => key.startsWith('.'))) {
        return exportsValue;
    }

    return undefined;
}

export function listExportedSubpaths(packageJson: Record<string, unknown>): string[] {
    const exportsValue = packageJson.exports;
    if (exportsValue === undefined) {
        return [];
    }

    if (typeof exportsValue === 'string' || Array.isArray(exportsValue)) {
        return ['.'];
    }

    if (!isRecord(exportsValue)) {
        return [];
    }

    const subpaths = Object.keys(exportsValue).filter((key) => key.startsWith('.')).sort();
    return subpaths.length === 0 ? ['.'] : subpaths;
}

export function getTypesPath(
    packageJson: Record<string, unknown>,
    subpath: string,
): string | undefined {
    const exportEntry = getExportEntry(packageJson, subpath);
    const exportTypes = findTypesPath(exportEntry);
    if (exportTypes !== undefined) {
        return exportTypes;
    }

    if (subpath === '.') {
        if (typeof packageJson.types === 'string') {
            return packageJson.types;
        }
        if (typeof packageJson.typings === 'string') {
            return packageJson.typings;
        }
    }

    return undefined;
}

function normalizeSubpath(subpath: string): string {
    if (subpath === '' || subpath === '.') {
        return '.';
    }
    return subpath.startsWith('./') ? subpath : `./${subpath}`;
}

function findTypesPath(value: unknown): string | undefined {
    if (typeof value === 'string') {
        return isDeclarationPath(value) ? value : undefined;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findTypesPath(item);
            if (found !== undefined) {
                return found;
            }
        }
        return undefined;
    }

    if (!isRecord(value)) {
        return undefined;
    }

    if (typeof value.types === 'string') {
        return value.types;
    }
    if (typeof value.typings === 'string') {
        return value.typings;
    }

    for (const entry of Object.values(value)) {
        const found = findTypesPath(entry);
        if (found !== undefined) {
            return found;
        }
    }

    return undefined;
}

function isDeclarationPath(value: string): boolean {
    return /\.(?:d\.)?[cm]?ts$/u.test(value);
}

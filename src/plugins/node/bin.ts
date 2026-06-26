import { isRecord } from './package-json.js';

export function getBinTarget(
    packageJson: Record<string, unknown>,
    packageName: string,
    binName: string,
): string | undefined {
    const bin = packageJson.bin;
    if (typeof bin === 'string') {
        return binName === packageName || binName === packageName.split('/').at(-1) ? bin : undefined;
    }

    if (isRecord(bin) && typeof bin[binName] === 'string') {
        return bin[binName];
    }

    return undefined;
}

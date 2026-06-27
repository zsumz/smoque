import { writeFile } from 'node:fs/promises';

export async function writeTemplateFile(
    path: string,
    content: string,
    force: boolean,
): Promise<'created' | 'exists'> {
    try {
        await writeFile(path, content, { flag: force ? 'w' : 'wx' });
        return 'created';
    } catch (error) {
        if (isFileExistsError(error)) {
            return 'exists';
        }
        throw error;
    }
}

function isFileExistsError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST';
}

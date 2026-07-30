import { writeFile } from 'node:fs/promises';

import { hasErrorCode } from '../../shared/errors.js';

export async function writeTemplateFile(
    path: string,
    content: string,
    force: boolean,
): Promise<'created' | 'exists'> {
    try {
        await writeFile(path, content, { flag: force ? 'w' : 'wx' });
        return 'created';
    } catch (error) {
        if (hasErrorCode(error, 'EEXIST')) {
            return 'exists';
        }
        throw error;
    }
}

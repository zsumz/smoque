import { randomBytes } from 'node:crypto';

import { SmokeError } from '../../errors.js';
import type { SmokeContext } from '../../types.js';

export function generateProjectName(t: SmokeContext): string {
    const suite = t.suite.name.toLowerCase().replace(/[^a-z0-9_-]+/gu, '-').replace(/^-+|-+$/gu, '');
    const suffix = randomBytes(3).toString('hex');
    const stem = suite.length > 0 ? suite : 'suite';
    return normalizeProjectName(`smoque-${stem}-${Date.now().toString(36)}-${suffix}`);
}

export function normalizeProjectName(projectName: string): string {
    const normalized = projectName.toLowerCase().replace(/[^a-z0-9_-]+/gu, '-').replace(/^-+|-+$/gu, '');
    if (!/^[a-z0-9][a-z0-9_-]*$/u.test(normalized)) {
        throw new SmokeError(`Invalid Docker Compose project name: ${projectName}`, {
            projectName,
            expected: 'lowercase letters, digits, dashes, or underscores; must start with a letter or digit',
        });
    }

    return normalized.slice(0, 63);
}

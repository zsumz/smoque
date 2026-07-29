import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
    initialSmokeTemplate,
    smokeAgentsTemplate,
    smokePackageTemplate,
    smokeTsconfigTemplate,
} from '../templates/scaffold.js';
import { writeTemplateFile } from '../templates/write-template-file.js';

export async function initCommand(args: string[]): Promise<number> {
    const force = parseInitOptions(args);
    const smokeDir = resolve(process.cwd(), 'smoke');
    const smokePath = resolve(smokeDir, 'project.smoke.ts');
    const agentsPath = resolve(smokeDir, 'AGENTS.md');
    const packagePath = resolve(smokeDir, 'package.json');
    const tsconfigPath = resolve(smokeDir, 'tsconfig.json');

    await mkdir(smokeDir, { recursive: true });

    const created: string[] = [];
    const skipped: string[] = [];

    const smokeResult = await writeTemplateFile(smokePath, initialSmokeTemplate, force);
    if (smokeResult === 'created') {
        created.push('smoke/project.smoke.ts');
    } else {
        skipped.push('smoke/project.smoke.ts');
    }

    const agentsResult = await writeTemplateFile(agentsPath, smokeAgentsTemplate, force);
    if (agentsResult === 'created') {
        created.push('smoke/AGENTS.md');
    } else {
        skipped.push('smoke/AGENTS.md');
    }

    const packageResult = await writeTemplateFile(
        packagePath,
        smokePackageTemplate,
        force,
    );
    if (packageResult === 'created') {
        created.push('smoke/package.json');
    } else {
        skipped.push('smoke/package.json');
    }

    const tsconfigResult = await writeTemplateFile(
        tsconfigPath,
        smokeTsconfigTemplate,
        force,
    );
    if (tsconfigResult === 'created') {
        created.push('smoke/tsconfig.json');
    } else {
        skipped.push('smoke/tsconfig.json');
    }

    for (const path of created) {
        console.log(`${force ? 'Wrote' : 'Created'} ${path}`);
    }

    for (const path of skipped) {
        console.log(`Skipped ${path}; already exists.`);
    }

    if (skipped.length > 0 && !force) {
        console.log('Re-run with --force to overwrite existing scaffold files.');
    }

    console.log('Next: smoque list');
    console.log('Next: smoque run');
    return 0;
}

function parseInitOptions(args: string[]): boolean {
    let force = false;
    for (const arg of args) {
        if (arg === '--force') {
            force = true;
        } else {
            throw new Error(`Unknown smoque init option: ${arg}`);
        }
    }
    return force;
}

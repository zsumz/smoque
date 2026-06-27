import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { smokeAgentsTemplate } from '../templates/scaffold.js';
import { writeTemplateFile } from '../templates/write-template-file.js';

export async function agentsCommand(args: string[]): Promise<number> {
    const subcommand = args[0];
    if (subcommand !== 'init') {
        console.error(
            subcommand
                ? `Unknown smoque agents command: ${subcommand}`
                : 'smoque agents requires a command.',
        );
        console.error('Usage: smoque agents init [--force]');
        return 2;
    }

    const force = parseAgentsInitOptions(args.slice(1));
    const smokeDir = resolve(process.cwd(), 'smoke');
    const agentsPath = resolve(smokeDir, 'AGENTS.md');

    await mkdir(smokeDir, { recursive: true });

    const result = await writeTemplateFile(agentsPath, smokeAgentsTemplate, force);
    if (result === 'exists') {
        console.error('smoke/AGENTS.md already exists. Re-run with --force to overwrite it.');
        return 2;
    }

    console.log(`${force ? 'Updated' : 'Created'} smoke/AGENTS.md`);
    return 0;
}

function parseAgentsInitOptions(args: string[]): boolean {
    let force = false;
    for (const arg of args) {
        if (arg === '--force') {
            force = true;
        } else {
            throw new Error(`Unknown smoque agents init option: ${arg}`);
        }
    }
    return force;
}

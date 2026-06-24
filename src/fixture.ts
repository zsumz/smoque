import { chmod, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import { SmokeError } from './errors.js';
import { resolveContextPath, toPathRef } from './path-ref.js';
import type { FixtureApi, FixtureTemplateOptions, PathRef, SmokeContext } from './types.js';

type FixtureContext = Pick<SmokeContext, 'repoRoot' | 'tempDir'>;

export function createFixtureApi(context: FixtureContext): FixtureApi {
    return {
        async fromTemplate(template, options = {}): Promise<PathRef> {
            const source = resolveContextPath(context.repoRoot(), template);
            const destination = options.dir === undefined
                ? await context.tempDir(`fixture-${basename(source) || 'template'}`)
                : typeof options.dir === 'string'
                    ? toPathRef(options.dir, context.repoRoot())
                    : options.dir;
            const destinationPath = destination.toString();

            await assertTemplateDirectory(source, destinationPath);
            await copyTemplateDirectory(source, destinationPath, options);

            return destination;
        },
    };
}

async function assertTemplateDirectory(source: string, destination: string): Promise<void> {
    let sourceStat;
    try {
        sourceStat = await stat(source);
    } catch {
        throw new SmokeError(`Fixture template directory not found: ${source}`, {
            template: source,
            destination,
        });
    }

    if (!sourceStat.isDirectory()) {
        throw new SmokeError(`Fixture template path must be a directory: ${source}`, {
            template: source,
            destination,
        });
    }
}

async function copyTemplateDirectory(
    source: string,
    destination: string,
    options: FixtureTemplateOptions,
): Promise<void> {
    await mkdir(destination, { recursive: true });
    const entries = await readdir(source, { withFileTypes: true });

    for (const entry of entries) {
        const sourcePath = join(source, entry.name);
        const destinationPath = join(destination, entry.name);

        if (entry.isDirectory()) {
            await copyTemplateDirectory(sourcePath, destinationPath, options);
        } else if (entry.isFile()) {
            await copyTemplateFile(sourcePath, destinationPath, options);
        }
    }
}

async function copyTemplateFile(
    source: string,
    destination: string,
    options: FixtureTemplateOptions,
): Promise<void> {
    const content = await readFile(source);
    const sourceStat = await stat(source);

    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, renderTemplateContent(content, options));
    await chmod(destination, sourceStat.mode);
}

function renderTemplateContent(content: Buffer, options: FixtureTemplateOptions): Buffer | string {
    const tokens = options.tokens ?? {};
    if (Object.keys(tokens).length === 0 || !isTextLike(content)) {
        return content;
    }

    let rendered = content.toString('utf8');
    for (const [key, value] of Object.entries(tokens)) {
        rendered = rendered.split(`{{${key}}}`).join(String(value));
    }
    return rendered;
}

function isTextLike(content: Buffer): boolean {
    return !content.includes(0);
}

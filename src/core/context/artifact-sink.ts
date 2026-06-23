import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import type { ArtifactAttachedEvent, SmokeEvent } from '../../events.js';
import { toPathRef } from '../../path-ref.js';
import type { ArtifactSink } from '../../types.js';

export interface ArtifactSinkOptions {
    suiteId: string;
    currentStepId: () => string | undefined;
    emit: (event: SmokeEvent) => Promise<void>;
    redactText: (value: string) => string;
}

export function createArtifactSink(options: ArtifactSinkOptions): ArtifactSink {
    return {
        file: async (path, name) => {
            const pathRef = toPathRef(path);
            const event = createArtifactEvent(options, {
                name: name ?? pathRef.toString(),
                path: pathRef.toString(),
                kind: 'file',
            });
            return options.emit(event);
        },
        dir: async (path, name) => {
            const pathRef = toPathRef(path);
            const event = createArtifactEvent(options, {
                name: name ?? pathRef.toString(),
                path: pathRef.toString(),
                kind: 'dir',
            });
            return options.emit(event);
        },
        text: async (name, value) => {
            const artifactDir = await mkdtemp(resolve(tmpdir(), 'smoque-artifact-'));
            const artifactPath = resolve(artifactDir, safeArtifactFileName(name));
            await writeFile(artifactPath, options.redactText(value), 'utf8');

            const event = createArtifactEvent(options, {
                name,
                path: artifactPath,
                kind: 'text',
            });
            return options.emit(event);
        },
    };
}

function createArtifactEvent(
    options: ArtifactSinkOptions,
    artifact: Pick<ArtifactAttachedEvent, 'name' | 'path' | 'kind'>,
): ArtifactAttachedEvent {
    const event: ArtifactAttachedEvent = {
        type: 'artifact.attached',
        suiteId: options.suiteId,
        ...artifact,
    };
    const stepId = options.currentStepId();
    if (stepId) {
        event.stepId = stepId;
    }
    return event;
}

function safeArtifactFileName(name: string): string {
    const safeName = name.replace(/[^a-zA-Z0-9._-]+/gu, '-').replace(/^-+|-+$/gu, '') || 'artifact';
    return safeName.includes('.') ? safeName : `${safeName}.txt`;
}

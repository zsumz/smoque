import type { ArtifactSink } from '../../types/artifacts.js';
import type { ComposeRecoveryError } from './errors.js';
import { formatError, wrapComposeError } from './errors.js';

interface RecoverableComposeProject {
    readonly projectName: string;
    attachOnFailure(attach: ArtifactSink): Promise<void>;
    cleanup(): Promise<void>;
}

export async function rethrowComposeStartFailure(
    error: unknown,
    project: RecoverableComposeProject,
    attach: ArtifactSink,
): Promise<never> {
    const recoveryErrors: ComposeRecoveryError[] = [];

    try {
        await project.attachOnFailure(attach);
    } catch (recoveryError) {
        recoveryErrors.push({
            phase: 'evidence',
            message: formatError(recoveryError),
        });
    }

    try {
        await project.cleanup();
    } catch (recoveryError) {
        recoveryErrors.push({
            phase: 'cleanup',
            message: formatError(recoveryError),
        });
    }

    throw wrapComposeError(error, project.projectName, recoveryErrors);
}

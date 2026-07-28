import type { SerializedSmokeError } from '../../events.js';
import type { ArtifactSink, SmokeResource } from '../../types.js';

type ErrorSerializer = (error: unknown) => SerializedSmokeError;

export class SuiteResourceTracker {
    private readonly cleanupStack: Array<() => Promise<void> | void> = [];
    private readonly resources: SmokeResource[] = [];
    private readonly trackedResources: WeakSet<SmokeResource> = new WeakSet();
    private readonly managedResources: WeakSet<SmokeResource> = new WeakSet();

    constructor(private readonly serializeError: ErrorSerializer) {}

    public addCleanup(cleanup: () => Promise<void> | void): void {
        this.cleanupStack.push(cleanup);
    }

    public add(resource: SmokeResource): void {
        if (this.trackedResources.has(resource)) {
            return;
        }

        this.trackedResources.add(resource);
        this.resources.push(resource);
    }

    public addManaged(resource: SmokeResource): void {
        this.add(resource);
        if (this.managedResources.has(resource)) {
            return;
        }

        this.managedResources.add(resource);
        this.cleanupStack.push(async () => resource.cleanup());
    }

    public async cleanup(): Promise<SerializedSmokeError[]> {
        const errors: SerializedSmokeError[] = [];

        for (const cleanup of this.cleanupStack.splice(0).reverse()) {
            try {
                await cleanup();
            } catch (error) {
                errors.push(this.serializeError(error));
            }
        }

        return errors;
    }

    public async attachOnFailure(sink: ArtifactSink): Promise<SerializedSmokeError[]> {
        const errors: SerializedSmokeError[] = [];

        for (const resource of this.resources) {
            if (!resource.attachOnFailure) {
                continue;
            }

            try {
                await resource.attachOnFailure(sink);
            } catch (error) {
                errors.push(this.serializeError(error));
            }
        }

        return errors;
    }
}

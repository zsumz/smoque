import { SmokeError } from '../errors.js';
import type { SmokePlugin } from '../plugin.js';
import type { SmokeSuite, SuiteOptions } from '../types.js';
import {
    clearExtensionBucket,
    cloneExtensionBucket,
    createExtensionBucket,
    createPluginRegistry,
    type ExtensionBucket,
} from './plugin-registry.js';
import type { SuiteCallback } from './smoke-api.js';

export interface RegisteredSuite {
    suite: SmokeSuite;
    options: SuiteOptions;
    fn: SuiteCallback;
}

export class SmokeRegistry {
    private nextSuiteId = 1;
    private readonly suites: RegisteredSuite[] = [];
    private readonly plugins: Set<string> = new Set();
    private readonly pendingPluginRegistrations: Array<Promise<void>> = [];
    private readonly extensions: ExtensionBucket = createExtensionBucket();

    public addSuite(name: string, options: SuiteOptions, fn: SuiteCallback, file: string | undefined): void {
        if (this.suites.some((entry) => entry.suite.name === name)) {
            throw new SmokeError(`Duplicate smoke suite name: ${name}`, { suite: name });
        }

        const suite: SmokeSuite = {
            id: `suite-${String(this.nextSuiteId++)}`,
            name,
            tags: options.tags ?? [],
        };
        if (file !== undefined) {
            suite.file = file;
        }

        this.suites.push({ suite, options, fn });
    }

    public use(plugin: SmokePlugin): void {
        if (this.plugins.has(plugin.name)) {
            throw new SmokeError(`Duplicate smoke plugin: ${plugin.name}`, { plugin: plugin.name });
        }

        const registration = plugin.register(createPluginRegistry(this.extensions, plugin.name));
        this.plugins.add(plugin.name);
        if (isPromiseLike(registration)) {
            this.pendingPluginRegistrations.push(registration);
        }
    }

    public getSuites(): SmokeSuite[] {
        return this.suites.map((entry) => ({ ...entry.suite, tags: [...entry.suite.tags] }));
    }

    public getDefinitions(): RegisteredSuite[] {
        return this.suites.map((entry) => {
            const options: SuiteOptions = { ...entry.options };
            if (entry.options.tags) {
                options.tags = [...entry.options.tags];
            }

            return {
                suite: { ...entry.suite, tags: [...entry.suite.tags] },
                options,
                fn: entry.fn,
            };
        });
    }

    public async ready(): Promise<void> {
        await Promise.all(this.pendingPluginRegistrations.splice(0));
    }

    public getExtensions(): ExtensionBucket {
        return cloneExtensionBucket(this.extensions);
    }

    public reset(): void {
        this.nextSuiteId = 1;
        this.suites.length = 0;
        this.plugins.clear();
        this.pendingPluginRegistrations.length = 0;
        clearExtensionBucket(this.extensions);
    }
}

function isPromiseLike(value: unknown): value is Promise<void> {
    return typeof value === 'object' && value !== null && 'then' in value;
}

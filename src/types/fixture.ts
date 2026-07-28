import type { PathRef } from './path-ref.js';

export interface FixtureApi {
    fromTemplate(template: string | PathRef, options?: FixtureTemplateOptions): Promise<PathRef>;
}

export interface FixtureTemplateOptions {
    dir?: string | PathRef;
    tokens?: Record<string, string | number | boolean>;
}

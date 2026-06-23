export function mergeEnv(overrides: Record<string, string | undefined> | undefined): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env };

    for (const [key, value] of Object.entries(overrides ?? {})) {
        if (value === undefined) {
            env[key] = undefined;
        } else {
            env[key] = value;
        }
    }

    return env;
}

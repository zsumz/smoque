export function withEnvironment(
    values: Readonly<Record<string, string>>,
    fn: () => void,
): void {
    const previous: Map<string, string | undefined> = new Map();
    for (const [name, value] of Object.entries(values)) {
        previous.set(name, process.env[name]);
        process.env[name] = value;
    }

    const missingNames = [
        'SMOQUE_MISSING',
        'SMOQUE_REQUIRED_STRING',
        'SMOQUE_REQUIRED_PATH',
        'SMOQUE_REQUIRED_INT',
    ];
    for (const name of missingNames) {
        if (!previous.has(name)) {
            previous.set(name, process.env[name]);
        }
        Reflect.deleteProperty(process.env, name);
    }

    try {
        fn();
    } finally {
        for (const [name, value] of previous) {
            if (value === undefined) {
                Reflect.deleteProperty(process.env, name);
            } else {
                process.env[name] = value;
            }
        }
    }
}

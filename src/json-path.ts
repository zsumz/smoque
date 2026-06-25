export function readJsonPath(value: unknown, path: string): unknown {
    if (!path.startsWith('$.')) {
        throw new Error(`Only simple $.path JSON paths are supported, got: ${path}`);
    }

    return path
        .slice(2)
        .split('.')
        .filter(Boolean)
        .reduce<unknown>((cursor, part) => {
            if (typeof cursor !== 'object' || cursor === null) {
                return undefined;
            }
            return (cursor as Record<string, unknown>)[part];
        }, value);
}

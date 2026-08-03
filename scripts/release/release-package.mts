export function readPackFilename(value: unknown): string {
    if (!Array.isArray(value) || value.length !== 1) {
        throw new Error('npm pack must return exactly one package.');
    }
    const entry: unknown = value[0];
    if (
        typeof entry !== 'object'
        || entry === null
        || !('filename' in entry)
        || typeof entry.filename !== 'string'
    ) {
        throw new Error('npm pack did not return a package filename.');
    }
    return entry.filename;
}

const allowedLayerImports: Readonly<Record<string, ReadonlySet<string>>> = {
    assertions: new Set(['shared', 'types']),
    cli: new Set(['shared', 'types']),
    command: new Set(['shared', 'types']),
    core: new Set(['assertions', 'command', 'types']),
    plugins: new Set(['assertions', 'shared', 'types']),
    ports: new Set(['types']),
    reporting: new Set(['types']),
    shared: new Set(['types']),
    types: new Set(),
};

export function layerImportFailure(
    source: string,
    target: string,
): string | undefined {
    const sourceLayer = nestedSourceLayer(source);
    const targetLayer = nestedSourceLayer(target);
    if (sourceLayer === undefined || targetLayer === undefined || sourceLayer === targetLayer) {
        return undefined;
    }
    const allowed = allowedLayerImports[sourceLayer];
    if (allowed === undefined) {
        return `source layer "${sourceLayer}" has no declared import policy.`;
    }
    if (!allowed.has(targetLayer)) {
        return `${sourceLayer} modules must not import the ${targetLayer} layer.`;
    }
    return undefined;
}

function nestedSourceLayer(relative: string): string | undefined {
    const segments = relative.split('/');
    return segments[0] === 'src' && segments.length > 2 ? segments[1] : undefined;
}

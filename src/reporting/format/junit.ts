export function seconds(durationMs: number): string {
    return (durationMs / 1000).toFixed(3);
}

export function indentXml(xml: string): string {
    return xml
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n');
}

export function escapeXml(value: string): string {
    return value
        .replace(/&/gu, '&amp;')
        .replace(/</gu, '&lt;')
        .replace(/>/gu, '&gt;')
        .replace(/"/gu, '&quot;')
        .replace(/'/gu, '&apos;');
}

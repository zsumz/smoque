export function parseOptionalJson(text: string): unknown {
    if (text.trim() === '') {
        return undefined;
    }

    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

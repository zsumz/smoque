import { readFile } from 'node:fs/promises';

export interface MarkdownSnippet {
    sourceFile: string;
    heading: string;
    code: string;
    language: 'ts' | 'js';
    expectedFailure: boolean;
    fixture?: string;
    startLine: number;
    index: number;
}

export async function extractMarkdownSnippets(file: string): Promise<MarkdownSnippet[]> {
    const text = await readFile(file, 'utf8');
    const lines = text.split(/\r?\n/u);
    const snippets: MarkdownSnippet[] = [];
    const headings: string[] = [];
    let fence:
    | {
        marker: string;
        info: string;
        startLine: number;
        code: string[];
        heading: string;
    }
    | undefined;

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? '';

        if (fence) {
            if (line.startsWith(fence.marker)) {
                const metadata = parseSnippetMetadata(fence.info);
                if (metadata) {
                    const snippet: MarkdownSnippet = {
                        sourceFile: file,
                        heading: fence.heading,
                        code: fence.code.join('\n'),
                        language: metadata.language,
                        expectedFailure: metadata.expectedFailure,
                        startLine: fence.startLine,
                        index: snippets.length + 1,
                    };
                    if (metadata.fixture !== undefined) {
                        snippet.fixture = metadata.fixture;
                    }
                    snippets.push(snippet);
                }
                fence = undefined;
            } else {
                fence.code.push(line);
            }
            continue;
        }

        const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/u.exec(line);
        if (heading) {
            const level = heading[1]?.length ?? 1;
            headings.splice(level - 1);
            headings[level - 1] = heading[2] ?? 'Untitled';
            continue;
        }

        const openingFence = /^(```+|~~~+)\s*(.*?)\s*$/u.exec(line);
        if (openingFence) {
            fence = {
                marker: openingFence[1] ?? '```',
                info: openingFence[2] ?? '',
                startLine: index + 2,
                code: [],
                heading: headings.filter(Boolean).join(' > ') || 'Document',
            };
        }
    }

    return snippets;
}

function parseSnippetMetadata(info: string):
  | {
      language: 'ts' | 'js';
      expectedFailure: boolean;
      fixture?: string;
  }
  | undefined {
    const tokens = info.split(/\s+/u).map((token) => token.trim()).filter(Boolean);
    if (!tokens.some((token) => token === 'smoque' || token === 'smoque-smoke' || token === 'smoque-snippet')) {
        return undefined;
    }

    const languageToken = tokens.find((token) =>
        ['ts', 'typescript', 'mts', 'js', 'javascript', 'mjs'].includes(token),
    );
    const metadata: {
        language: 'ts' | 'js';
        expectedFailure: boolean;
        fixture?: string;
    } = {
        language: languageToken === 'js' || languageToken === 'javascript' || languageToken === 'mjs' ? 'js' : 'ts',
        expectedFailure: tokens.some((token) => token === 'expect-fail' || token === 'expected-failure'),
    };

    const fixture = tokens.find((token) => token.startsWith('fixture='))?.slice('fixture='.length);
    if (fixture) {
        metadata.fixture = fixture;
    }
    return metadata;
}

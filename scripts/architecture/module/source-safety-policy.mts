export type SourceSafetyIssue = 'explicit-any' | 'non-null-assertion';

export function sourceSafetyMessage(issue: SourceSafetyIssue): string {
    if (issue === 'explicit-any') {
        return 'explicit any is forbidden in production source.';
    }
    return 'non-null assertions are forbidden in production source.';
}

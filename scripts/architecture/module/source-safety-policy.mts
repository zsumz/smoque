export type SourceSafetyIssue =
    | 'explicit-any'
    | 'non-null-assertion'
    | 'unknown-double-assertion';

export function sourceSafetyMessage(issue: SourceSafetyIssue): string {
    if (issue === 'explicit-any') {
        return 'explicit any is forbidden in production source.';
    }
    if (issue === 'non-null-assertion') {
        return 'non-null assertions are forbidden in production source.';
    }
    return 'double assertions through unknown are forbidden in production source.';
}

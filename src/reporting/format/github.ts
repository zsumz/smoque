export function escapeWorkflowData(value: string): string {
    return value.replace(/%/gu, '%25').replace(/\r/gu, '%0D').replace(/\n/gu, '%0A');
}

export function escapeWorkflowProperty(value: string): string {
    return escapeWorkflowData(value).replace(/:/gu, '%3A').replace(/,/gu, '%2C');
}

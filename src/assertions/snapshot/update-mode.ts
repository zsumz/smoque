let updateSnapshots = false;

export function setSnapshotUpdateMode(update: boolean): void {
    updateSnapshots = update;
}

export function isSnapshotUpdateMode(): boolean {
    return updateSnapshots;
}

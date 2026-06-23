export class SmokeSkipSignal extends Error {
    constructor(reason: string) {
        super(reason);
        this.name = 'SmokeSkip';
    }
}

import { SmokeError } from '../../errors.js';

export function listTarEntries(buffer: Buffer, archivePath: string): string[] {
    const entries: string[] = [];
    let offset = 0;

    while (offset + 512 <= buffer.byteLength) {
        const header = buffer.subarray(offset, offset + 512);
        if (isZeroBlock(header)) {
            return entries;
        }

        const name = readNullTerminated(header, 0, 100);
        const prefix = readNullTerminated(header, 345, 155);
        const size = readTarSize(header);
        const type = readNullTerminated(header, 156, 1);
        const entryName = prefix ? `${prefix}/${name}` : name;

        if (entryName && type !== 'g' && type !== 'x') {
            entries.push(entryName);
        }

        offset += 512 + Math.ceil(size / 512) * 512;
    }

    throw new SmokeError(`Archive did not contain a complete tar end marker: ${archivePath}`, { path: archivePath });
}

function isZeroBlock(buffer: Buffer): boolean {
    return buffer.every((byte) => byte === 0);
}

function readNullTerminated(buffer: Buffer, offset: number, length: number): string {
    const slice = buffer.subarray(offset, offset + length);
    const end = slice.indexOf(0);
    return slice.subarray(0, end === -1 ? undefined : end).toString('utf8').trim();
}

function readTarSize(header: Buffer): number {
    const raw = readNullTerminated(header, 124, 12).trim();
    if (raw === '') {
        return 0;
    }

    const size = Number.parseInt(raw, 8);
    if (!Number.isFinite(size)) {
        throw new SmokeError(`Invalid tar entry size: ${raw}`);
    }
    return size;
}

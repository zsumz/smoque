import { SmokeError } from '../../errors.js';

export function listZipEntries(buffer: Buffer, archivePath: string): string[] {
    const eocdOffset = findEndOfCentralDirectory(buffer);
    if (eocdOffset === -1) {
        throw new SmokeError(`Archive did not contain a ZIP central directory: ${archivePath}`, { path: archivePath });
    }

    const entryCount = buffer.readUInt16LE(eocdOffset + 10);
    let offset = buffer.readUInt32LE(eocdOffset + 16);
    const entries: string[] = [];

    for (let index = 0; index < entryCount; index += 1) {
        if (offset + 46 > buffer.byteLength || buffer.readUInt32LE(offset) !== 0x02014b50) {
            throw new SmokeError(`Archive ZIP central directory is malformed: ${archivePath}`, { path: archivePath });
        }

        const nameLength = buffer.readUInt16LE(offset + 28);
        const extraLength = buffer.readUInt16LE(offset + 30);
        const commentLength = buffer.readUInt16LE(offset + 32);
        const nameStart = offset + 46;
        const nameEnd = nameStart + nameLength;
        entries.push(buffer.subarray(nameStart, nameEnd).toString('utf8'));
        offset = nameEnd + extraLength + commentLength;
    }

    return entries;
}

export function isZipArchive(buffer: Buffer): boolean {
    return buffer.byteLength >= 4 && buffer.readUInt32LE(0) === 0x04034b50;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
    const minimumOffset = Math.max(0, buffer.byteLength - 65_557);
    for (let offset = buffer.byteLength - 22; offset >= minimumOffset; offset -= 1) {
        if (buffer.readUInt32LE(offset) === 0x06054b50) {
            return offset;
        }
    }
    return -1;
}

export type ArchiveEntry = readonly [name: string, content: string];

export function createTar(entries: readonly ArchiveEntry[]): Buffer {
    const chunks: Buffer[] = [];

    for (const [name, content] of entries) {
        const body = Buffer.from(content, 'utf8');
        const header = Buffer.alloc(512);
        header.write(name, 0, 100, 'utf8');
        header.write('0000644\0', 100, 8, 'ascii');
        header.write('0000000\0', 108, 8, 'ascii');
        header.write('0000000\0', 116, 8, 'ascii');
        header.write(`${body.byteLength.toString(8).padStart(11, '0')}\0`, 124, 12, 'ascii');
        header.write(
            `${Math.floor(Date.now() / 1000).toString(8).padStart(11, '0')}\0`,
            136,
            12,
            'ascii',
        );
        header.fill(0x20, 148, 156);
        header.write('0', 156, 1, 'ascii');
        header.write('ustar\0', 257, 6, 'ascii');
        header.write('00', 263, 2, 'ascii');

        const checksum = [...header].reduce((sum, byte) => sum + byte, 0);
        header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
        chunks.push(header, body, Buffer.alloc((512 - body.byteLength % 512) % 512));
    }

    chunks.push(Buffer.alloc(1024));
    return Buffer.concat(chunks);
}

export function createZip(entries: readonly ArchiveEntry[]): Buffer {
    const localChunks: Buffer[] = [];
    const centralChunks: Buffer[] = [];
    let offset = 0;

    for (const [name, content] of entries) {
        const nameBuffer = Buffer.from(name, 'utf8');
        const body = Buffer.from(content, 'utf8');
        const crc = crc32(body);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(body.byteLength, 18);
        local.writeUInt32LE(body.byteLength, 22);
        local.writeUInt16LE(nameBuffer.byteLength, 26);
        localChunks.push(local, nameBuffer, body);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(body.byteLength, 20);
        central.writeUInt32LE(body.byteLength, 24);
        central.writeUInt16LE(nameBuffer.byteLength, 28);
        central.writeUInt32LE(offset, 42);
        centralChunks.push(central, nameBuffer);

        offset += local.byteLength + nameBuffer.byteLength + body.byteLength;
    }

    const centralDirectory = Buffer.concat(centralChunks);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralDirectory.byteLength, 12);
    end.writeUInt32LE(offset, 16);

    return Buffer.concat([...localChunks, centralDirectory, end]);
}

function crc32(buffer: Buffer): number {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc ^= byte;
        for (let index = 0; index < 8; index += 1) {
            crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0);
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

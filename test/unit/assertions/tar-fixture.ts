export function createTar(entries: ReadonlyArray<readonly [string, string]>): Buffer {
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

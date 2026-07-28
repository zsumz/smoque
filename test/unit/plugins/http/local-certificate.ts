import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

export interface LocalCertificate {
    keyPath: string;
    certPath: string;
}

export function generateLocalCertificate(root: string): LocalCertificate {
    const keyPath = join(root, 'local.key');
    const certPath = join(root, 'local.crt');
    const result = spawnSync('openssl', [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        keyPath,
        '-out',
        certPath,
        '-days',
        '1',
        '-subj',
        '/CN=localhost',
        '-addext',
        'subjectAltName=DNS:localhost,IP:127.0.0.1',
    ], {
        encoding: 'utf8',
    });

    if (result.status !== 0) {
        const reason = (result.error?.message ?? result.stderr) || result.stdout;
        throw new Error(`openssl failed: ${reason}`);
    }

    return { keyPath, certPath };
}

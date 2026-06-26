import { readFile } from 'node:fs/promises';

import { SmokeError } from '../../errors.js';
import { isLocalHost } from '../../network.js';
import { pathToString } from '../../path-ref.js';
import type { PathRef } from '../../types.js';

export interface HttpTlsOptions {
    ca?: string | PathRef;
    selfSigned?: boolean;
}

export interface NormalizedTlsOptions {
    ca?: string;
    rejectUnauthorized?: boolean;
}

export async function normalizeTlsOptions(
    url: URL,
    options: HttpTlsOptions | undefined,
): Promise<NormalizedTlsOptions> {
    if (options === undefined) {
        return {};
    }

    if (url.protocol !== 'https:') {
        throw new SmokeError('HTTP TLS options require an https:// URL.', {
            url: url.toString(),
            protocol: url.protocol,
        });
    }

    if (options.selfSigned && !isLocalHost(url.hostname)) {
        throw new SmokeError('Self-signed TLS mode is only allowed for local hosts.', {
            url: url.toString(),
            host: url.hostname,
        });
    }

    const normalized: NormalizedTlsOptions = {};
    if (options.ca !== undefined) {
        normalized.ca = await readFile(pathToString(options.ca), 'utf8');
    }
    if (options.selfSigned) {
        normalized.rejectUnauthorized = false;
    }
    return normalized;
}

export function classifyHttpRequestError(method: string, url: string, error: unknown): unknown {
    const tlsError = tlsVerificationError(error);
    if (tlsError) {
        return new SmokeError(
            `TLS verification failed for HTTP ${method.toUpperCase()} ${url}: ${tlsError.message}`,
            {
                kind: 'tls',
                method: method.toUpperCase(),
                url,
                code: tlsError.code,
                cause: tlsError.message,
            },
        );
    }
    return error;
}

function tlsVerificationError(error: unknown): Error & { code?: string } | undefined {
    if (isTlsVerificationError(error)) {
        return error;
    }
    if (error instanceof Error && 'cause' in error && isTlsVerificationError(error.cause)) {
        return error.cause;
    }
    return undefined;
}

function isTlsVerificationError(error: unknown): error is Error & { code?: string } {
    if (!(error instanceof Error)) {
        return false;
    }

    const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
    return [
        'DEPTH_ZERO_SELF_SIGNED_CERT',
        'SELF_SIGNED_CERT_IN_CHAIN',
        'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        'CERT_HAS_EXPIRED',
        'ERR_TLS_CERT_ALTNAME_INVALID',
    ].includes(code);
}

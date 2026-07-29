import { executeHttpRedirects } from '../../../../dist/plugins/http/client-redirect.js';

const url = process.argv[2];
if (url === undefined) {
    throw new Error('Expected an HTTPS source URL');
}

try {
    await executeHttpRedirects({
        method: 'GET',
        url,
        headers: new Headers(),
        body: undefined,
        options: {},
        signal: new AbortController().signal,
        authorize: () => undefined,
    });
    throw new Error('Expected the HTTPS-to-HTTP redirect to be rejected');
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('Refusing HTTP redirect from https:// to http://')) {
        throw error;
    }
    console.log(message);
}

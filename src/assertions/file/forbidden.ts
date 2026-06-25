import type { ForbiddenRule } from '../../types.js';

export const forbidden = {
    privateKeys(): ForbiddenRule {
        return {
            name: 'private key',
            pattern: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/u,
            scope: 'content',
        };
    },
    envFiles(): ForbiddenRule {
        return {
            name: 'env file',
            pattern: /(?:^|\/)\.env(?:$|[./])/u,
            scope: 'path',
        };
    },
    npmTokens(): ForbiddenRule {
        return {
            name: 'npm token',
            pattern: /(?:_authToken\s*=|npm_[A-Za-z0-9]{36})/u,
            scope: 'content',
        };
    },
    internalFiles(): ForbiddenRule {
        return {
            name: 'internal file',
            pattern: /(?:^|\/)(?:\.codex|\.cursor|internal-notes|NOTES\.private)(?:\/|$)/u,
            scope: 'path',
        };
    },
    defaults(): ForbiddenRule[] {
        return [
            this.privateKeys(),
            this.envFiles(),
            this.npmTokens(),
            this.internalFiles(),
        ];
    },
};

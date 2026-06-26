export function composeFileContents(options: { database: string; user: string; password: string; image: string }): string {
    return [
        'services:',
        '  postgres:',
        `    image: ${options.image}`,
        '    environment:',
        `      POSTGRES_DB: ${options.database}`,
        `      POSTGRES_USER: ${options.user}`,
        `      POSTGRES_PASSWORD: ${options.password}`,
        '    ports:',
        '      - "5432"',
        '',
    ].join('\n');
}

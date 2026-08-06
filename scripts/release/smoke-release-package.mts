import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
    runReleaseCommand,
    type CommandResult,
} from './release-command.mts';
import { isStableReleaseVersion } from './release-contract.mts';

const tarballArgument = process.argv[2] ?? process.env.SALLYPORT_TARBALL;
const manifest = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
) as { version?: unknown };
const version = process.argv[3] ?? manifest.version;
if (tarballArgument === undefined) {
    throw new Error('Set SALLYPORT_TARBALL or pass <tarball> <version>.');
}
if (typeof version !== 'string') {
    throw new Error('package.json must declare a string version.');
}
if (!isStableReleaseVersion(version)) {
    throw new Error(`Invalid stable release version: ${version}`);
}

const tarball = path.resolve(tarballArgument);
const root = await mkdtemp(path.join(tmpdir(), 'smoque-release-'));

try {
    await writeFile(
        path.join(root, 'package.json'),
        `${JSON.stringify({ private: true, type: 'module' }, null, 2)}\n`,
    );
    run('npm', [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        tarball,
        '--cache',
        path.join(root, '.npm-cache'),
    ]);
    const cli = path.join(root, 'node_modules', 'smoque', 'dist', 'cli', 'main.js');
    const actualVersion = run(process.execPath, [cli, '--version']).stdout.trim();
    if (actualVersion !== version) {
        throw new Error(`Expected smoque ${version}, received ${actualVersion}.`);
    }
    run(process.execPath, [
        '--input-type=module',
        '--eval',
        [
            'const api = await import(\'smoque\');',
            'const plugin = await import(\'smoque/plugin\');',
            'if (typeof api.smoke?.suite !== \'function\') process.exit(1);',
            'if (typeof plugin.definePlugin !== \'function\') process.exit(1);',
        ].join(' '),
    ]);
    run(process.execPath, [cli, 'init']);
    run(process.execPath, [cli, 'doctor']);
    run(process.execPath, [cli, 'run', 'smoke/']);
    console.log(`Verified installed smoque@${version} from ${path.basename(tarball)}.`);
} finally {
    await rm(root, { recursive: true, force: true });
}

function run(command: string, args: readonly string[]): CommandResult {
    return runReleaseCommand(command, args, root);
}

import { agentsCommand } from './commands/agents.js';
import { doctorCommand } from './commands/doctor.js';
import { printHelp } from './commands/help.js';
import { initCommand } from './commands/init.js';
import { listCommand } from './commands/list.js';
import { runCommand } from './commands/run.js';
import { snippetsCommand } from './commands/snippets.js';
import { readPackageVersion } from './commands/version.js';

export async function runCli(args: string[]): Promise<void> {
    const command = args[0] ?? 'help';

    try {
        switch (command) {
            case 'help':
            case '--help':
            case '-h':
                printHelp();
                break;
            case '--version':
            case '-v':
                console.log(await readPackageVersion());
                break;
            case 'run':
                process.exitCode = await runCommand(args.slice(1));
                break;
            case 'list':
                process.exitCode = await listCommand(args.slice(1));
                break;
            case 'snippets':
                process.exitCode = await snippetsCommand(args.slice(1));
                break;
            case 'agents':
                process.exitCode = await agentsCommand(args.slice(1));
                break;
            case 'init':
                process.exitCode = await initCommand(args.slice(1));
                break;
            case 'doctor':
                process.exitCode = await doctorCommand(args.slice(1));
                break;
            default:
                console.error(`Unknown command: ${command}`);
                printHelp();
                process.exitCode = 2;
        }
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}

import type { CommandResult } from '../types.js';
import type { CommandExpectation, JsonPathExpectation } from './types.js';
import { createJsonPathExpectation, parseStructuredJson } from './json-path-expectation.js';

export function createCommandExpectation(result: CommandResult): CommandExpectation {
    return {
        stdoutJsonPath(path): JsonPathExpectation {
            return createJsonPathExpectation(() => parseStructuredJson(result.stdout, {
                source: 'command',
                output: 'stdout',
                command: result.command,
                args: result.args,
                cwd: result.cwd,
            }), path, {
                source: 'command',
                output: 'stdout',
                command: result.command,
                args: result.args,
                cwd: result.cwd,
            });
        },
        stderrJsonPath(path): JsonPathExpectation {
            return createJsonPathExpectation(() => parseStructuredJson(result.stderr, {
                source: 'command',
                output: 'stderr',
                command: result.command,
                args: result.args,
                cwd: result.cwd,
            }), path, {
                source: 'command',
                output: 'stderr',
                command: result.command,
                args: result.args,
                cwd: result.cwd,
            });
        },
    };
}

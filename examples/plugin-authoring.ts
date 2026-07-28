import type { ProbeResult } from 'smoque';
import { definePlugin, type SmokePlugin } from 'smoque/plugin';

export default function examplePlugin(): SmokePlugin {
    return definePlugin({
        name: 'smoque-widget',
        version: '0.1.0',

        register(registry) {
            registry.action('widget.build', async (t) => {
                await t.step('build widget', async () => {
                    await t.cmd('widget', ['build']);
                });
            });

            registry.probe('widget.ready', (_t, options) => ({
                description: `widget ready: ${JSON.stringify(options)}`,
                async check(): Promise<ProbeResult> {
                    // Return the real readiness result here.
                    return Promise.resolve({ ready: false, message: 'not implemented' });
                },
            }));
        },
    });
}

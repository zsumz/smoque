import { definePlugin } from "smoque/plugin";

export default function examplePlugin() {
  return definePlugin({
    name: "smoque-widget",
    version: "0.1.0",

    register(registry) {
      registry.action("widget.build", async (t, options) => {
        await t.step("build widget", async () => {
          await t.cmd("widget", ["build"], options as never);
        });
      });

      registry.probe("widget.ready", (_t, options) => ({
        description: `widget ready: ${JSON.stringify(options)}`,
        async check() {
          // Return the real readiness result here.
          return { ready: false, message: "not implemented" };
        },
      }));
    },
  });
}

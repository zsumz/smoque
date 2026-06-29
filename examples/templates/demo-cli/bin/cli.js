#!/usr/bin/env node

const name = process.argv[process.argv.indexOf("--name") + 1] ?? "world";
console.log(`hello ${name}`);

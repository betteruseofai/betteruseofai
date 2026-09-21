#!/usr/bin/env node
import { run } from './run.js';

const result = await run(process.argv.slice(2));
if (result.stdout !== '') process.stdout.write(`${result.stdout}\n`);
if (result.stderr !== '') process.stderr.write(`${result.stderr}\n`);

/*
 * The exit code is set rather than forced. On Linux and macOS a write to a
 * pipe is asynchronous, and process.exit straight after a large one cut the
 * dashboard file off at 146 kB on the first run on GitHub, while Windows,
 * where pipe writes are synchronous, produced the whole file. Letting the
 * process end on its own lets the write finish first.
 */
process.exitCode = result.code;

#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validatePortable } from './lib/conformance.mjs';
const root = path.resolve(process.argv[2] ?? fileURLToPath(new URL('../', import.meta.url)));
const errors = validatePortable(root);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Agent Plugins 1.0.0 schemas and package semantics are valid.');

#!/usr/bin/env node
import { runCli } from './cli.js';

export * from './cli.js';
export * from './context.js';
export * from './clipboard.js';
export * from './ui.js';

runCli();

#!/usr/bin/env node
import { ContextOsMcpServer } from './server.js';

export * from './protocol.js';
export * from './tools.js';
export * from './handlers.js';
export * from './server.js';

const server = new ContextOsMcpServer();
server.startStdio();

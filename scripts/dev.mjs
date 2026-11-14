// One command to start everything: the game window (Vite) and the multiplayer server.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (args) => spawn(process.execPath, args, { cwd: root, stdio: 'inherit' });

const server = run(['server/index.js']);
const web = run(['node_modules/vite/bin/vite.js', '--open', '--host']);

const stop = () => { server.kill(); web.kill(); process.exit(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
web.on('exit', stop);

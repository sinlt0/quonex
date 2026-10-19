const path = require('path');

const PIPE_PREFIX = '\\\\.\\pipe\\';
const DEFAULT_NAME = 'quonex-internal';

function isNamedPipe(value) {
  return typeof value === 'string' && (value.startsWith(PIPE_PREFIX) || value.startsWith('//./pipe/'));
}

function toPipe(value) {
  if (isNamedPipe(value)) return PIPE_PREFIX + value.slice(PIPE_PREFIX.length).replace(/\//g, '\\');
  const base = path.basename(String(value).replace(/\\/g, '/')).replace(/\.sock$/i, '').replace(/[^A-Za-z0-9._-]/g, '');
  return PIPE_PREFIX + (base || DEFAULT_NAME);
}

function resolveSocketPath(platform = process.platform) {
  const configured = (process.env.INTERNAL_API_SOCKET || '').trim();

  if (platform === 'win32') {
    return toPipe(configured || DEFAULT_NAME);
  }

  if (configured && !isNamedPipe(configured)) return configured;
  return `/tmp/${DEFAULT_NAME}.sock`;
}

module.exports = { resolveSocketPath, isNamedPipe };

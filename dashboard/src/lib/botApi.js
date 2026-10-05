import http from 'http';

const DEFAULT_SOCKET_PATH = '/tmp/quonex-internal.sock';

function callBotApi(path, body) {
  const socketPath = process.env.INTERNAL_API_SOCKET || DEFAULT_SOCKET_PATH;
  const payload = JSON.stringify(body);

  return new Promise(resolve => {
    const req = http.request(
      {
        socketPath,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'X-Internal-Secret': process.env.INTERNAL_API_SECRET
        }
      },
      res => {
        let raw = '';
        res.on('data', chunk => {
          raw += chunk;
        });
        res.on('end', () => {
          let data = null;
          try {
            data = raw ? JSON.parse(raw) : null;
          } catch {
            data = null;
          }
          const status = res.statusCode || 0;
          resolve({ ok: status >= 200 && status < 300, status, data });
        });
      }
    );

    req.on('error', error => {
      console.error(`Could not reach the bot's internal API at socket ${socketPath}${path}:`, error.message);
      resolve({ ok: false, status: 0, data: { ok: false, error: 'unreachable' } });
    });

    req.write(payload);
    req.end();
  });
}

export async function notifyPanelCreated({ guildId, channelId, panelId }) {
  return callBotApi('/api/panel-created', { guildId, channelId, panelId });
}

export async function notifyPanelDeleted({ guildId, panelId }) {
  return callBotApi('/api/panel-deleted', { guildId, panelId });
}

export async function notifyStaffRoleAdd({ guildId, panelId, roleId }) {
  return callBotApi('/api/staff-role-add', { guildId, panelId, roleId });
}

export async function notifyStaffRoleRemove({ guildId, panelId, roleId }) {
  return callBotApi('/api/staff-role-remove', { guildId, panelId, roleId });
}

export async function notifyTicketClose({ guildId, channelId, closerId }) {
  return callBotApi('/api/ticket-close', { guildId, channelId, closerId });
}

const http = require('http');
const fs = require('fs');
const { postPanelMessage, deletePanel, addStaffRole, removeStaffRole, closeTicket } = require('./tickets');
const {
  postPanelMessage: postApplicationPanelMessage,
  deleteApplicationPanel,
  decideApplication,
  syncReviewMessage
} = require('./applications');
const prisma = require('./db');

const DEFAULT_SOCKET_PATH = '/tmp/quonex-internal.sock';

function verifySecret(req) {
  const header = req.headers['x-internal-secret'];
  const expected = process.env.INTERNAL_API_SECRET;

  if (!expected) {
    console.error('INTERNAL_API_SECRET is not set on the bot - every internal API request will be rejected.');
    return false;
  }

  if (!header) {
    console.error(`Internal API request to ${req.method} ${req.url} had no X-Internal-Secret header.`);
    return false;
  }

  if (header !== expected) {
    console.error(
      `Internal API request to ${req.method} ${req.url} sent a secret that does not match (received length ${header.length}, expected length ${expected.length}).`
    );
    return false;
  }

  return true;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function handlePanelCreated(client, body) {
  const { guildId, channelId, panelId } = body;

  const panel = await prisma.panel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) {
    return { status: 404, body: { ok: false, error: 'panel-missing' } };
  }

  const guild = client.guilds.cache.get(guildId);
  const channel = guild ? guild.channels.cache.get(channelId) : null;
  if (!channel) {
    return { status: 404, body: { ok: false, error: 'channel-missing' } };
  }

  const updated = await postPanelMessage(panel, channel);
  return { status: 200, body: { ok: true, panel: updated } };
}

async function handlePanelDeleted(client, body) {
  const { guildId, panelId } = body;

  const result = await deletePanel(guildId, panelId, client);
  if (!result.ok) {
    return { status: 404, body: result };
  }

  return { status: 200, body: result };
}

async function handleStaffRoleAdd(client, body) {
  const { guildId, panelId, roleId } = body;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return { status: 404, body: { ok: false, error: 'guild-missing' } };
  }

  const result = await addStaffRole({ guild, panelId, roleId });
  return { status: result.ok ? 200 : 400, body: result };
}

async function handleStaffRoleRemove(client, body) {
  const { guildId, panelId, roleId } = body;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return { status: 404, body: { ok: false, error: 'guild-missing' } };
  }

  const result = await removeStaffRole({ guild, panelId, roleId });
  return { status: result.ok ? 200 : 400, body: result };
}

async function handleTicketClose(client, body) {
  const { guildId, channelId, closerId } = body;

  const ticket = await prisma.ticket.findUnique({ where: { channelId } });
  if (!ticket || ticket.guildId !== guildId) {
    return { status: 404, body: { ok: false, error: 'ticket-missing' } };
  }

  const guild = client.guilds.cache.get(guildId);
  const channel = guild ? guild.channels.cache.get(channelId) : null;
  if (!channel) {
    return { status: 404, body: { ok: false, error: 'channel-missing' } };
  }

  const result = await closeTicket({ ticket, channel, closerId });
  return { status: result.ok ? 200 : 400, body: result };
}

async function handleApplicationPanelCreated(client, body) {
  const { guildId, channelId, panelId } = body;

  const panel = await prisma.applicationPanel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) {
    return { status: 404, body: { ok: false, error: 'panel-missing' } };
  }

  const guild = client.guilds.cache.get(guildId);
  const channel = guild ? guild.channels.cache.get(channelId) : null;
  if (!channel) {
    return { status: 404, body: { ok: false, error: 'channel-missing' } };
  }

  const updated = await postApplicationPanelMessage(panel, channel);
  return { status: 200, body: { ok: true, panel: updated } };
}

async function handleApplicationPanelDeleted(client, body) {
  const { guildId, panelId } = body;

  const result = await deleteApplicationPanel(guildId, panelId, client);
  if (!result.ok) {
    return { status: 404, body: result };
  }

  return { status: 200, body: result };
}

async function handleApplicationDecide(client, body) {
  const { guildId, applicationId, reviewerId, accept } = body;

  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application || application.guildId !== guildId) {
    return { status: 404, body: { ok: false, error: 'application-missing' } };
  }

  const panel = await prisma.applicationPanel.findUnique({ where: { id: application.panelId } });
  if (!panel) {
    return { status: 404, body: { ok: false, error: 'panel-missing' } };
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return { status: 404, body: { ok: false, error: 'guild-missing' } };
  }

  const result = await decideApplication({ application, panel, guild, reviewerId, accept });
  if (!result.ok) {
    return { status: 400, body: result };
  }

  await syncReviewMessage(guild, panel, result.application);
  return { status: 200, body: result };
}

const ROUTES = {
  'POST /api/panel-created': handlePanelCreated,
  'POST /api/panel-deleted': handlePanelDeleted,
  'POST /api/staff-role-add': handleStaffRoleAdd,
  'POST /api/staff-role-remove': handleStaffRoleRemove,
  'POST /api/ticket-close': handleTicketClose,
  'POST /api/application-panel-created': handleApplicationPanelCreated,
  'POST /api/application-panel-deleted': handleApplicationPanelDeleted,
  'POST /api/application-decide': handleApplicationDecide
};

function startInternalApi(client) {
  const socketPath = process.env.INTERNAL_API_SOCKET || DEFAULT_SOCKET_PATH;

  if (!process.env.INTERNAL_API_SECRET) {
    console.error('INTERNAL_API_SECRET is not set - the internal API will reject every request until it is.');
  }

  if (fs.existsSync(socketPath)) {
    fs.unlinkSync(socketPath);
  }

  const server = http.createServer(async (req, res) => {
    if (!verifySecret(req)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return;
    }

    const handler = ROUTES[`${req.method} ${req.url}`];
    if (!handler) {
      sendJson(res, 404, { ok: false, error: 'not-found' });
      return;
    }

    try {
      const body = await readBody(req);
      const result = await handler(client, body);
      sendJson(res, result.status, result.body);
    } catch (error) {
      console.error('Internal API error:', error);
      sendJson(res, 500, { ok: false, error: 'internal-error' });
    }
  });

  server.on('error', error => {
    console.error(`Internal API server error on socket ${socketPath}:`, error);
  });

  server.listen(socketPath, () => {
    console.log(`Internal API listening on unix socket ${socketPath}`);
  });

  const cleanup = () => {
    if (fs.existsSync(socketPath)) {
      fs.unlinkSync(socketPath);
    }
  };

  process.on('exit', cleanup);

  return server;
}

module.exports = { startInternalApi };

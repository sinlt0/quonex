const prisma = require('../db');
const { loadConfig } = require('../security/store');
const { v2Message, SEPARATOR } = require('../components');
const { LABELS } = require('./engine');
const { em } = require('../emojis');

const WEEK = 7 * 86400000;

async function gatherStats(guildId, days, moderatorId) {
  const since = new Date(Date.now() - days * 86400000);
  const where = { guildId, createdAt: { gte: since }, ...(moderatorId ? { moderatorId } : {}) };
  const [cases, appeals, reports] = await Promise.all([
    prisma.modCase.findMany({ where, select: { action: true, moderatorId: true, auto: true, userId: true }, take: 20000 }),
    prisma.modAppeal.groupBy({ by: ['status'], where: { guildId, createdAt: { gte: since } }, _count: true }),
    prisma.modReport.groupBy({ by: ['status'], where: { guildId, createdAt: { gte: since } }, _count: true })
  ]);

  const byAction = {};
  const byModerator = new Map();
  let auto = 0;
  for (const row of cases) {
    byAction[row.action] = (byAction[row.action] || 0) + 1;
    if (row.auto) {
      auto += 1;
      continue;
    }
    byModerator.set(row.moderatorId, (byModerator.get(row.moderatorId) || 0) + 1);
  }
  const count = (list, status) => (list.find(item => item.status === status) || { _count: 0 })._count;
  return {
    total: cases.length,
    auto,
    manual: cases.length - auto,
    uniqueUsers: new Set(cases.map(row => row.userId)).size,
    byAction,
    moderators: [...byModerator.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
    appeals: { pending: count(appeals, 'pending'), approved: count(appeals, 'approved'), denied: count(appeals, 'denied') },
    reports: { open: count(reports, 'open'), resolved: count(reports, 'resolved'), dismissed: count(reports, 'dismissed') }
  };
}

function statsLines(stats, days, title) {
  const actions = Object.entries(stats.byAction)
    .sort((a, b) => b[1] - a[1])
    .map(([action, number]) => `${number} ${(LABELS[action] || action).toLowerCase()}`)
    .join(' · ');
  const lines = [`### ${em.modCase} ${title} · last ${days} day${days === 1 ? '' : 's'}`, `**${stats.total}** actions on **${stats.uniqueUsers}** users · ${stats.manual} by moderators · ${stats.auto} automatic`];
  if (actions) lines.push(actions);
  if (stats.moderators.length) lines.push(SEPARATOR, '**Top moderators**', ...stats.moderators.map(([id, number], index) => `${index + 1}. <@${id}> · ${number}`));
  const a = stats.appeals;
  const r = stats.reports;
  lines.push(SEPARATOR, `**Appeals:** ${a.approved} approved · ${a.denied} denied · ${a.pending} pending`, `**Reports:** ${r.resolved} resolved · ${r.dismissed} dismissed · ${r.open} open`);
  return lines;
}

async function sendWeekly(guild) {
  const config = (await loadConfig(guild.id)).moderation;
  const core = (await loadConfig(guild.id)).core;
  const id = config.logChannelId || core.logChannelId;
  const channel = id ? guild.channels.cache.get(id) : null;
  if (!channel || !channel.isTextBased()) return false;
  const stats = await gatherStats(guild.id, 7);
  await channel.send(v2Message(statsLines(stats, 7, 'Weekly moderation report'), { footer: false, allowedMentions: { parse: [] } })).catch(() => {});
  return true;
}

async function weeklyPass(client) {
  for (const guild of client.guilds.cache.values()) {
    const config = (await loadConfig(guild.id)).moderation;
    if (!config.weeklyReport) continue;
    const counter = await prisma.modCounter.findUnique({ where: { guildId: guild.id } });
    const last = counter && counter.lastReportAt ? counter.lastReportAt.getTime() : null;
    if (last && Date.now() - last < WEEK) continue;
    if (last && !(await sendWeekly(guild))) continue;
    await prisma.modCounter.upsert({ where: { guildId: guild.id }, update: { lastReportAt: new Date() }, create: { guildId: guild.id, lastReportAt: new Date() } });
  }
}

function startModReports(client) {
  const run = () => weeklyPass(client).catch(error => console.error('Weekly moderation report failed:', error));
  setTimeout(run, 120000);
  setInterval(run, 3600000);
}

module.exports = { gatherStats, statsLines, startModReports };

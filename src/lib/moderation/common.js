const { send } = require('../security/commandKit');
const { loadConfig } = require('../security/store');
const { parseDuration, formatDuration } = require('./duration');
const { em } = require('../emojis');

async function begin(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const config = (await loadConfig(interaction.guild.id)).moderation;
  return config;
}

function needReason(interaction, config) {
  const reason = interaction.options.getString('reason');
  if (config.requireReason && !reason) return { error: 'This server requires a reason.' };
  return { reason };
}

async function fail(interaction, text) {
  return send(interaction, [`${em.alert} ${text}`]);
}

function readDuration(interaction, name = 'duration') {
  const raw = interaction.options.getString(name);
  if (!raw) return { minutes: null };
  const minutes = parseDuration(raw);
  if (!minutes) return { error: 'Invalid duration. Use forms like 30m, 2h, 7d or 1d12h.' };
  return { minutes };
}

function caseLine(res, verb) {
  return `${em.on} ${verb} **${res.user.tag}** · case #${res.row.caseNumber}`;
}

module.exports = { begin, needReason, fail, readDuration, caseLine, send, formatDuration };

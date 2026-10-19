const { v2Message } = require('../components');
const { loadConfig } = require('../security/store');
const { parseDuration } = require('./duration');
const { em } = require('../emojis');

async function reply(message, lines) {
  return message.reply(v2Message(lines, { footer: false, allowedMentions: { parse: [] } }));
}

async function fail(message, text) {
  return reply(message, [`${em.alert} ${text}`]);
}

async function takeUser(message, args) {
  const first = args[0];
  if (!first) return { rest: [] };
  const id = (first.match(/^<@!?(\d+)>$/) || first.match(/^(\d{15,22})$/) || [])[1];
  if (!id) return { rest: args };
  const user = await message.client.users.fetch(id).catch(() => null);
  return { user, rest: args.slice(1) };
}

function takeDuration(args) {
  if (!args[0]) return { rest: args };
  const minutes = parseDuration(args[0]);
  if (!minutes) return { rest: args };
  return { minutes, rest: args.slice(1) };
}

async function gate(message, permission, usage) {
  if (!message.guild || !message.member) return null;
  if (!message.member.permissions.has(permission)) {
    await fail(message, 'You do not have permission to use this command.');
    return null;
  }
  return (await loadConfig(message.guild.id)).moderation;
}

function reasonText(config, rest, message) {
  const reason = rest.join(' ').trim();
  if (config.requireReason && !reason) {
    fail(message, 'This server requires a reason.');
    return { stop: true };
  }
  return { reason: reason || null };
}

async function needUser(message, args, usage) {
  const { user, rest } = await takeUser(message, args);
  if (!user) {
    await fail(message, `Mention a user or give their ID. Usage: \`${usage}\``);
    return {};
  }
  return { user, rest };
}

module.exports = { reply, fail, takeUser, takeDuration, gate, reasonText, needUser };

const { PermissionFlagsBits } = require('discord.js');
const { loadConfig, isExtraOwner } = require('./store');
const { v2Message } = require('../components');
const { SECURITY_ERRORS } = require('../../config/security');
const { em } = require('../emojis');

async function levelOf(guild, member) {
  if (guild.ownerId === member.id) return 'owner';
  if (await isExtraOwner(guild.id, member.id)) return 'extra';
  return 'member';
}

async function requireAccess(interaction, level = 'config') {
  if (!interaction.guild) {
    await interaction.reply(v2Message([SECURITY_ERRORS['guild-only']], { ephemeral: true, footer: false }));
    return false;
  }

  const member = interaction.member;
  const tier = await levelOf(interaction.guild, member);
  let allowed = false;

  if (level === 'owner') allowed = tier === 'owner';
  else if (level === 'trusted') allowed = tier === 'owner' || tier === 'extra';
  else {
    const config = (await loadConfig(interaction.guild.id)).core;
    allowed = tier !== 'member' || (!config.strictAccess && member.permissions.has(PermissionFlagsBits.Administrator));
  }

  if (!allowed) {
    const message = level === 'owner' ? SECURITY_ERRORS['owner-only'] : SECURITY_ERRORS['no-access'];
    await interaction.reply(v2Message([`${em.error} ${message}`], { ephemeral: true, footer: false }));
  }
  return allowed;
}

module.exports = { requireAccess, levelOf };

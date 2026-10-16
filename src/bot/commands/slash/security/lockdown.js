const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const prisma = require('../../../../lib/db');
const { requireAccess } = require('../../../../lib/security/access');
const kit = require('../../../../lib/security/commandKit');
const store = require('../../../../lib/security/store');
const { lockChannel, unlockChannel, lockServer, unlockServer, lockedChannelIds } = require('../../../../lib/security/lockdown');
const { securityLog } = require('../../../../lib/security/alerts');
const { em } = require('../../../../lib/emojis');

const MODULE = 'lockdown';
const TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum, ChannelType.GuildVoice, ChannelType.GuildStageVoice, ChannelType.GuildMedia];

function data() {
  const builder = new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('Lock a channel or the whole server, and restore exact permissions afterwards')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('channel')
        .setDescription('Lock one channel')
        .addChannelOption(option => option.setName('channel').setDescription('Channel (defaults to this one)').addChannelTypes(...TYPES))
        .addIntegerOption(option => option.setName('minutes').setDescription('Unlock automatically after this long').setMinValue(1).setMaxValue(10080))
        .addStringOption(option => option.setName('reason').setDescription('Reason').setMaxLength(200))
    )
    .addSubcommand(sub =>
      sub
        .setName('server')
        .setDescription('Lock every channel')
        .addIntegerOption(option => option.setName('minutes').setDescription('Unlock automatically after this long').setMinValue(1).setMaxValue(10080))
        .addStringOption(option => option.setName('reason').setDescription('Reason').setMaxLength(200))
    )
    .addSubcommand(sub =>
      sub
        .setName('end')
        .setDescription('Unlock a channel, or everything')
        .addChannelOption(option => option.setName('channel').setDescription('Only this channel (default: everything)').addChannelTypes(...TYPES))
    )
    .addSubcommand(sub => sub.setName('status').setDescription('Show locked channels and timers'));
  kit.addConfigSubcommands(builder);
  return builder;
}

async function expiry(guildId, kind, targetId, minutes) {
  if (!minutes) return null;
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000);
  await store.addTimer({ guildId, kind, targetId, expiresAt });
  return expiresAt;
}

module.exports = {
  data: data(),
  category: 'Security',
  usage: '/lockdown <channel|server|end|status|view|set|add|remove|reset>',
  async autocomplete(interaction) {
    if (!interaction.guild) return;
    await kit.configAutocomplete(interaction, MODULE);
  },
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (!(await requireAccess(interaction, 'config'))) return;
    const guild = interaction.guild;
    const o = interaction.options;
    const config = (await store.loadConfig(guild.id))[MODULE];

    if (sub === 'channel') {
      const channel = o.getChannel('channel') || interaction.channel;
      const minutes = o.getInteger('minutes') ?? (config.defaultMinutes || null);
      const reason = o.getString('reason') || `Lockdown by ${interaction.user.tag}`;
      await interaction.deferReply({ ephemeral: true });
      const result = await lockChannel(channel, { reason }).catch(() => ({ ok: false }));
      if (!result.ok) {
        await kit.send(interaction, [`${em.error} I could not lock <#${channel.id}>. It may already have nothing to deny, or I lack Manage Channels there.`]);
        return;
      }
      const until = await expiry(guild.id, 'unlock-channel', channel.id, minutes);
      await securityLog(guild, { module: 'lockdown', action: 'channel locked', severity: 'warning', executorId: interaction.user.id, lines: [`<#${channel.id}>`, reason] });
      await kit.send(interaction, [`${em.lock} Locked <#${channel.id}>${until ? `, unlocking <t:${Math.floor(until.getTime() / 1000)}:R>` : ''}.`]);
      return;
    }

    if (sub === 'server') {
      const minutes = o.getInteger('minutes') ?? (config.defaultMinutes || null);
      const reason = o.getString('reason') || `Server lockdown by ${interaction.user.tag}`;
      await interaction.deferReply({ ephemeral: true });
      const count = await lockServer(guild, { reason });
      const until = await expiry(guild.id, 'unlock-server', guild.id, minutes);
      await securityLog(guild, { module: 'lockdown', action: 'server locked', severity: 'critical', executorId: interaction.user.id, lines: [`${count} channels locked.`, reason] });
      await kit.send(interaction, [`${em.lock} Locked **${count}** channels${until ? `, unlocking <t:${Math.floor(until.getTime() / 1000)}:R>` : ''}. End it with \`/lockdown end\`.`]);
      return;
    }

    if (sub === 'end') {
      const channel = o.getChannel('channel');
      await interaction.deferReply({ ephemeral: true });
      if (channel) {
        const result = await unlockChannel(channel, { reason: `Unlocked by ${interaction.user.tag}` }).catch(() => ({ ok: false }));
        await store.cancelTimer(guild.id, 'unlock-channel', channel.id);
        await kit.send(interaction, [result.ok ? `${em.success} Unlocked <#${channel.id}> and restored its previous permissions.` : `${em.error} <#${channel.id}> was not locked by me.`]);
        return;
      }
      const count = await unlockServer(guild, { reason: `Unlocked by ${interaction.user.tag}` });
      await prisma.securityTimer.deleteMany({ where: { guildId: guild.id, kind: { in: ['unlock-server', 'unlock-channel'] } } });
      await securityLog(guild, { module: 'lockdown', action: 'lockdown ended', executorId: interaction.user.id, lines: [`${count} channels unlocked.`] });
      await kit.send(interaction, [`${em.success} Unlocked **${count}** channels and restored their previous permissions.`]);
      return;
    }

    if (sub === 'status') {
      const ids = await lockedChannelIds(guild.id);
      const timers = await prisma.securityTimer.findMany({ where: { guildId: guild.id, kind: { in: ['unlock-server', 'unlock-channel'] } } });
      const lines = [`## ${em.lock} Lockdown`, ids.length ? `**${ids.length}** locked: ${ids.slice(0, 30).map(id => `<#${id}>`).join(' ')}${ids.length > 30 ? ' …' : ''}` : 'Nothing is locked.'];
      for (const timer of timers) {
        lines.push(`${timer.kind === 'unlock-server' ? 'Server' : `<#${timer.targetId}>`} unlocks <t:${Math.floor(timer.expiresAt.getTime() / 1000)}:R>`);
      }
      await kit.send(interaction, kit.clip(lines));
      return;
    }

    await kit.runConfigSubcommand(interaction, sub, MODULE);
  }
};

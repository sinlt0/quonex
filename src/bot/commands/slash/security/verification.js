const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { requireAccess } = require('../../../../lib/security/access');
const kit = require('../../../../lib/security/commandKit');
const store = require('../../../../lib/security/store');
const { postPanel, grantVerification, requireVerification, isConfigured } = require('../../../../lib/security/verification');
const { securityLog } = require('../../../../lib/security/alerts');
const { em } = require('../../../../lib/emojis');

const MODULE = 'verification';

function data() {
  const builder = new SlashCommandBuilder()
    .setName('verification')
    .setDescription('Verify members with a button, captcha or passphrase before they get in')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('setup')
        .setDescription('Set up verification and post the panel')
        .addChannelOption(option => option.setName('channel').setDescription('Where to post the verify panel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
        .addRoleOption(option => option.setName('verified-role').setDescription('Role given after verifying'))
        .addRoleOption(option => option.setName('unverified-role').setDescription('Role given on join and removed after verifying'))
        .addStringOption(option => option.setName('mode').setDescription('How members verify').addChoices({ name: 'button', value: 'button' }, { name: 'captcha', value: 'captcha' }, { name: 'passphrase', value: 'passphrase' }))
        .addStringOption(option => option.setName('scope').setDescription('Who must verify').addChoices({ name: 'everyone', value: 'all' }, { name: 'suspicious accounts only', value: 'suspicious' }))
    )
    .addSubcommand(sub =>
      sub
        .setName('panel')
        .setDescription('Post or move the verify panel')
        .addChannelOption(option => option.setName('channel').setDescription('Channel (defaults to the saved one)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    )
    .addSubcommand(sub =>
      sub
        .setName('mode')
        .setDescription('Change how members verify')
        .addStringOption(option => option.setName('type').setDescription('Mode').setRequired(true).addChoices({ name: 'button', value: 'button' }, { name: 'captcha', value: 'captcha' }, { name: 'passphrase', value: 'passphrase' }))
        .addStringOption(option => option.setName('passphrase').setDescription('Phrase to type (passphrase mode)').setMaxLength(100))
        .addStringOption(option => option.setName('difficulty').setDescription('Captcha difficulty').addChoices({ name: 'easy', value: 'easy' }, { name: 'medium', value: 'medium' }, { name: 'hard', value: 'hard' }))
        .addIntegerOption(option => option.setName('length').setDescription('Captcha length').setMinValue(4).setMaxValue(8))
    )
    .addSubcommand(sub =>
      sub
        .setName('rules')
        .setDescription('Attempts, time limit and what happens on failure')
        .addIntegerOption(option => option.setName('attempts').setDescription('Wrong answers allowed').setMinValue(1).setMaxValue(10))
        .addIntegerOption(option => option.setName('time-limit-minutes').setDescription('Minutes to verify (0 means no limit)').setMinValue(0).setMaxValue(10080))
        .addStringOption(option => option.setName('fail-action').setDescription('Action on failure or timeout').addChoices({ name: 'none', value: 'none' }, { name: 'timeout', value: 'timeout' }, { name: 'kick', value: 'kick' }, { name: 'ban', value: 'ban' }))
        .addIntegerOption(option => option.setName('suspicious-age-days').setDescription('Accounts younger than this count as suspicious').setMinValue(0).setMaxValue(365))
        .addBooleanOption(option => option.setName('dm-on-join').setDescription('DM instructions when someone joins'))
    )
    .addSubcommand(sub =>
      sub
        .setName('panel-style')
        .setDescription('Customize the panel text')
        .addStringOption(option => option.setName('title').setDescription('Panel title').setMaxLength(100))
        .addStringOption(option => option.setName('text').setDescription('Panel text').setMaxLength(500))
        .addStringOption(option => option.setName('button').setDescription('Button label').setMaxLength(40))
        .addStringOption(option => option.setName('color').setDescription('Accent color like #6f5de0').setMaxLength(7))
    )
    .addSubcommand(sub => sub.setName('status').setDescription('Show verification settings'))
    .addSubcommand(sub => sub.setName('enable').setDescription('Turn verification on'))
    .addSubcommand(sub => sub.setName('disable').setDescription('Turn verification off'))
    .addSubcommand(sub => sub.setName('verify').setDescription('Verify a member by hand').addUserOption(option => option.setName('user').setDescription('Member').setRequired(true)))
    .addSubcommand(sub => sub.setName('unverify').setDescription('Send a member back through verification').addUserOption(option => option.setName('user').setDescription('Member').setRequired(true)));
  kit.addConfigSubcommands(builder);
  return builder;
}

async function applyMany(interaction, pairs) {
  const guildId = interaction.guild.id;
  const changes = pairs.filter(([, value]) => value !== null);
  if (!changes.length) {
    await kit.send(interaction, ['Pass at least one option to change something.']);
    return false;
  }
  for (const [key, value] of changes) {
    const result = await store.setValue(guildId, MODULE, key, String(value));
    if (!result.ok) {
      await kit.send(interaction, [`${em.error} Could not set ${key}. Check the value.`]);
      return false;
    }
  }
  return changes;
}

async function status(interaction) {
  const config = (await store.loadConfig(interaction.guild.id))[MODULE];
  const lines = [
    `## ${em.verify} Verification`,
    `${kit.onOff(config.enabled)} · mode **${config.mode}** · scope **${config.scope}**${config.scope === 'suspicious' ? ` (under ${config.suspiciousAgeDays} days)` : ''}`,
    `Verified role: ${kit.formatValue({ type: 'role' }, config.verifiedRoleId)} · unverified role: ${kit.formatValue({ type: 'role' }, config.unverifiedRoleId)}`,
    `Attempts **${config.maxAttempts}** · time limit **${config.timeLimitMinutes || 'none'}**${config.timeLimitMinutes ? ' min' : ''} · on fail **${config.failAction}**`,
    `Panel: ${config.panelChannelId ? `<#${config.panelChannelId}>` : '*not posted*'}`,
    isConfigured(config) ? `${em.success} Ready.` : `${em.error} Not active yet. Turn it on and set a verified or unverified role.`
  ];
  await kit.send(interaction, lines);
}

module.exports = {
  data: data(),
  category: 'Security',
  usage: '/verification <setup|panel|mode|rules|panel-style|status|enable|disable|verify|unverify|view|set|add|remove|reset>',
  async autocomplete(interaction) {
    if (!interaction.guild) return;
    await kit.configAutocomplete(interaction, MODULE);
  },
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (!(await requireAccess(interaction, 'config'))) return;
    const guild = interaction.guild;
    const o = interaction.options;

    if (sub === 'status') return status(interaction);

    if (sub === 'setup') {
      const channel = o.getChannel('channel');
      const verified = o.getRole('verified-role');
      const unverified = o.getRole('unverified-role');
      const current = (await store.loadConfig(guild.id))[MODULE];
      if (!verified && !unverified && !current.verifiedRoleId && !current.unverifiedRoleId) {
        await kit.send(interaction, [`${em.error} Choose a verified role, an unverified role, or both.`]);
        return;
      }
      const result = await applyMany(interaction, [['verifiedRoleId', verified ? verified.id : null], ['unverifiedRoleId', unverified ? unverified.id : null], ['mode', o.getString('mode')], ['scope', o.getString('scope')], ['enabled', 'true']]);
      if (!result) return;
      await interaction.deferReply({ ephemeral: true });
      const sent = await postPanel(guild, channel).catch(() => null);
      if (!sent) {
        await kit.send(interaction, [`${em.error} Settings saved, but I could not post in <#${channel.id}>. Check my permissions there.`]);
        return;
      }
      await securityLog(guild, { module: 'verification', action: 'verification set up', executorId: interaction.user.id });
      await kit.send(interaction, [`${em.success} Verification is on and the panel is in <#${channel.id}>.`, unverified ? '-# Deny the unverified role access to channels except the verify channel.' : '-# Only a verified role is set. Hide your channels from @everyone and show them to the verified role.']);
      return;
    }

    if (sub === 'panel') {
      const config = (await store.loadConfig(guild.id))[MODULE];
      const channel = o.getChannel('channel') || (config.panelChannelId ? guild.channels.cache.get(config.panelChannelId) : null);
      if (!channel) {
        await kit.send(interaction, [`${em.error} Pick a channel for the panel.`]);
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const sent = await postPanel(guild, channel).catch(() => null);
      await kit.send(interaction, [sent ? `${em.success} Panel posted in <#${channel.id}>.` : `${em.error} I could not post there.`]);
      return;
    }

    if (sub === 'enable' || sub === 'disable') {
      await store.setRaw(guild.id, MODULE, 'enabled', sub === 'enable');
      await kit.send(interaction, [sub === 'enable' ? `${em.success} Verification is on.` : `${em.success} Verification is off.`]);
      return;
    }

    if (sub === 'mode') {
      const changes = await applyMany(interaction, [['mode', o.getString('type')], ['passphrase', o.getString('passphrase')], ['captchaDifficulty', o.getString('difficulty')], ['captchaLength', o.getInteger('length')]]);
      if (changes) await kit.send(interaction, [`${em.success} Updated ${changes.map(([key]) => `\`${key}\``).join(', ')}.`, o.getString('type') === 'passphrase' && !o.getString('passphrase') ? '-# Set the phrase with the passphrase option.' : '-# Re-post the panel only if you changed its text.']);
      return;
    }

    if (sub === 'rules') {
      const changes = await applyMany(interaction, [['maxAttempts', o.getInteger('attempts')], ['timeLimitMinutes', o.getInteger('time-limit-minutes')], ['failAction', o.getString('fail-action')], ['suspiciousAgeDays', o.getInteger('suspicious-age-days')], ['dmOnJoin', o.getBoolean('dm-on-join')]]);
      if (changes) await kit.send(interaction, [`${em.success} Updated ${changes.map(([key]) => `\`${key}\``).join(', ')}.`]);
      return;
    }

    if (sub === 'panel-style') {
      const color = o.getString('color');
      if (color && !/^#[0-9a-f]{6}$/i.test(color)) {
        await kit.send(interaction, [`${em.error} Use a hex color like #6f5de0.`]);
        return;
      }
      const changes = await applyMany(interaction, [['panelTitle', o.getString('title')], ['panelText', o.getString('text')], ['panelButton', o.getString('button')], ['panelColor', color]]);
      if (changes) await kit.send(interaction, [`${em.success} Saved. Run \`/verification panel\` to refresh the posted panel.`]);
      return;
    }

    if (sub === 'verify' || sub === 'unverify') {
      const member = await guild.members.fetch(o.getUser('user').id).catch(() => null);
      if (!member) {
        await kit.send(interaction, [`${em.error} That user is not in the server.`]);
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      if (sub === 'verify') await grantVerification(member, `manual by ${interaction.user.tag}`);
      else await requireVerification(member, `manual by ${interaction.user.tag}`);
      await securityLog(guild, { module: 'verification', action: sub === 'verify' ? 'manually verified' : 'sent back to verification', executorId: interaction.user.id, targetId: member.id });
      await kit.send(interaction, [`${em.success} <@${member.id}> ${sub === 'verify' ? 'is now verified' : 'must verify again'}.`]);
      return;
    }

    await kit.runConfigSubcommand(interaction, sub, MODULE);
  }
};

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const prisma = require('../../../../lib/db');
const { requireAccess } = require('../../../../lib/security/access');
const kit = require('../../../../lib/security/commandKit');
const store = require('../../../../lib/security/store');
const { postPanel, grantVerification, requireVerification, isConfigured } = require('../../../../lib/security/verification');
const { securityLog } = require('../../../../lib/security/alerts');
const { runWizard } = require('../../../../lib/security/wizard');
const { buildVerificationWizard } = require('../../../../lib/security/wizards/verification');
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
        .setDescription('Guided setup: asks questions, creates roles and channels, posts the panel')
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
        .addStringOption(option => option.setName('type').setDescription('Mode').setRequired(true).addChoices({ name: 'button', value: 'button' }, { name: 'captcha', value: 'captcha' }, { name: 'passphrase', value: 'passphrase' }, { name: 'web (VPN and alt detection)', value: 'web' }))
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
    .addSubcommand(sub => {
      const actions = [{ name: 'allow', value: 'allow' }, { name: 'flag (verify but alert staff)', value: 'flag' }, { name: 'quarantine', value: 'quarantine' }, { name: 'block', value: 'block' }];
      return sub
        .setName('web')
        .setDescription('Web verification: VPN, alt and country checks')
        .addStringOption(option => option.setName('vpn-action').setDescription('When a VPN, proxy or Tor is detected').addChoices(...actions))
        .addStringOption(option => option.setName('alt-action').setDescription('When the member shares an IP or device with another member').addChoices(...actions))
        .addStringOption(option => option.setName('country-action').setDescription('For blocked or not allowed countries').addChoices(...actions))
        .addBooleanOption(option => option.setName('hosting').setDescription('Treat datacenter IPs like a VPN'))
        .addBooleanOption(option => option.setName('match-ip').setDescription('Match alts by IP'))
        .addBooleanOption(option => option.setName('match-device').setDescription('Match alts by device fingerprint'))
        .addStringOption(option => option.setName('block-country').setDescription('Block a country code, like ru'))
        .addStringOption(option => option.setName('unblock-country').setDescription('Unblock a country code'))
        .addStringOption(option => option.setName('only-country').setDescription('Only allow this country code (repeat to allow several)'))
        .addStringOption(option => option.setName('remove-only-country').setDescription('Remove a country code from the allowed list'))
        .addIntegerOption(option => option.setName('retention-days').setDescription('Days to remember hashed IPs and devices').setMinValue(1).setMaxValue(3650))
        .addIntegerOption(option => option.setName('link-minutes').setDescription('Minutes a verification link works').setMinValue(2).setMaxValue(120))
        .addIntegerOption(option => option.setName('attempts').setDescription('Tries per link').setMinValue(1).setMaxValue(10));
    })
    .addSubcommand(sub => sub.setName('alts').setDescription('Show members who share an IP or device with someone').addUserOption(option => option.setName('user').setDescription('Member').setRequired(true)))
    .addSubcommand(sub => sub.setName('forget').setDescription('Delete the stored web verification data for a member').addUserOption(option => option.setName('user').setDescription('Member').setRequired(true)))
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

async function web(interaction) {
  const guildId = interaction.guild.id;
  const o = interaction.options;
  const config = (await store.loadConfig(guildId))[MODULE];
  const pairs = [['webVpnAction', o.getString('vpn-action')], ['webAltAction', o.getString('alt-action')], ['webCountryAction', o.getString('country-action')], ['webHostingCounts', o.getBoolean('hosting')], ['webAltMatchIp', o.getBoolean('match-ip')], ['webAltMatchFingerprint', o.getBoolean('match-device')], ['webRetentionDays', o.getInteger('retention-days')], ['webLinkMinutes', o.getInteger('link-minutes')], ['webMaxAttempts', o.getInteger('attempts')]];
  const changes = pairs.filter(([, value]) => value !== null);
  const listOps = [['webBlockedCountries', o.getString('block-country'), true], ['webBlockedCountries', o.getString('unblock-country'), false], ['webAllowedCountries', o.getString('only-country'), true], ['webAllowedCountries', o.getString('remove-only-country'), false]].filter(([, value]) => value);

  for (const [key, value] of changes) {
    const result = await store.setValue(guildId, MODULE, key, String(value));
    if (!result.ok) {
      await kit.send(interaction, [`${em.error} Could not set ${key}.`]);
      return;
    }
  }
  for (const [key, value, add] of listOps) {
    const result = await store.mutateList(guildId, MODULE, key, value.trim(), add);
    if (!result.ok) {
      await kit.send(interaction, [`${em.error} Use a two-letter country code like ru or us.`]);
      return;
    }
  }

  const fresh = (await store.loadConfig(guildId))[MODULE];
  const lines = [
    `${changes.length || listOps.length ? `${em.success} Updated.` : '**Web verification**'}`,
    `Active when the method is **web** (now **${fresh.mode}**). VPN: **${fresh.webVpnAction}** · alts: **${fresh.webAltAction}** · country: **${fresh.webCountryAction}**`,
    `Datacenter IPs count as VPN: ${kit.onOff(fresh.webHostingCounts)} · match by IP ${kit.onOff(fresh.webAltMatchIp)} · by device ${kit.onOff(fresh.webAltMatchFingerprint)}`,
    `Blocked countries: ${fresh.webBlockedCountries.length ? fresh.webBlockedCountries.map(code => `\`${code}\``).join(' ') : '*none*'} · only allow: ${fresh.webAllowedCountries.length ? fresh.webAllowedCountries.map(code => `\`${code}\``).join(' ') : '*everywhere*'}`,
    `Link valid **${fresh.webLinkMinutes}** min · **${fresh.webMaxAttempts}** tries · remember **${fresh.webRetentionDays}** days`
  ];
  if (!process.env.DASHBOARD_URL && !process.env.AUTH_URL) lines.push(`${em.error} DASHBOARD_URL is not set on the bot, so web verification links cannot be created.`);
  await kit.send(interaction, lines);
}

async function alts(interaction) {
  const guildId = interaction.guild.id;
  const user = interaction.options.getUser('user');
  const identity = await prisma.verifiedIdentity.findUnique({ where: { guildId_userId: { guildId, userId: user.id } } });
  if (!identity) {
    await kit.send(interaction, [`No web verification data stored for <@${user.id}>.`]);
    return;
  }
  const or = [];
  if (identity.ipHash) or.push({ ipHash: identity.ipHash });
  if (identity.fpHash) or.push({ fpHash: identity.fpHash });
  const matches = or.length ? await prisma.verifiedIdentity.findMany({ where: { guildId, userId: { not: user.id }, OR: or }, take: 15 }) : [];
  const lines = [`**<@${user.id}>** verified <t:${Math.floor(identity.createdAt.getTime() / 1000)}:R> · ${identity.vpn ? `VPN (${identity.vpnKind || 'vpn'})` : 'no VPN'} · country ${identity.country ? identity.country.toUpperCase() : 'unknown'} · result **${identity.verdict}**`];
  if (!matches.length) lines.push('No linked accounts found.');
  else {
    lines.push('Linked accounts:');
    for (const match of matches) {
      const by = [identity.ipHash && match.ipHash === identity.ipHash ? 'same IP' : null, identity.fpHash && match.fpHash === identity.fpHash ? 'same device' : null].filter(Boolean).join(' + ');
      lines.push(`• <@${match.userId}> — ${by}`);
    }
    lines.push('-# Shared IPs can be households or schools. Treat a match as a lead, not proof.');
  }
  await kit.send(interaction, kit.clip(lines));
}

async function forget(interaction) {
  const user = interaction.options.getUser('user');
  const result = await prisma.verifiedIdentity.deleteMany({ where: { guildId: interaction.guild.id, userId: user.id } });
  await kit.send(interaction, [result.count ? `${em.success} Deleted the stored data for <@${user.id}>.` : 'Nothing was stored for that member.']);
}

module.exports = {
  data: data(),
  category: 'Security',
  usage: '/verification <setup|panel|mode|rules|panel-style|web|alts|forget|status|enable|disable|verify|unverify|view|set|add|remove|reset>',
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
    if (sub === 'web') return web(interaction);
    if (sub === 'alts') return alts(interaction);
    if (sub === 'forget') return forget(interaction);

    if (sub === 'setup') {
      const current = (await store.loadConfig(guild.id))[MODULE];
      await runWizard(interaction, buildVerificationWizard(guild, current));
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

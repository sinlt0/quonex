const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { requireAccess } = require('../../../../lib/security/access');
const kit = require('../../../../lib/security/commandKit');
const store = require('../../../../lib/security/store');
const { isRaid, startRaid, endRaid, joinStats } = require('../../../../lib/security/antiraid');
const { RAID_ACTIONS } = require('../../../../config/security');
const { em } = require('../../../../lib/emojis');

const MODULE = 'antiraid';
const ACTIONS = RAID_ACTIONS.map(item => ({ name: item, value: item }));

function data() {
  const builder = new SlashCommandBuilder()
    .setName('antiraid')
    .setDescription('Stop raids: join-rate detection, join gate and risk scoring')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub.setName('status').setDescription('Show anti-raid settings and current join activity'))
    .addSubcommand(sub => sub.setName('enable').setDescription('Turn anti-raid on'))
    .addSubcommand(sub => sub.setName('disable').setDescription('Turn anti-raid off'))
    .addSubcommand(sub =>
      sub
        .setName('threshold')
        .setDescription('How many joins count as a raid')
        .addIntegerOption(option => option.setName('joins').setDescription('Joins needed').setMinValue(2).setMaxValue(500))
        .addIntegerOption(option => option.setName('seconds').setDescription('Within this many seconds').setMinValue(2).setMaxValue(600))
    )
    .addSubcommand(sub =>
      sub
        .setName('action')
        .setDescription('What happens during a raid')
        .addStringOption(option => option.setName('on-join').setDescription('Action for members who join during a raid').addChoices(...ACTIONS))
        .addIntegerOption(option => option.setName('minutes').setDescription('How long raid mode lasts').setMinValue(1).setMaxValue(1440))
        .addBooleanOption(option => option.setName('punish-recent').setDescription('Also punish the joiners who triggered it'))
        .addBooleanOption(option => option.setName('pause-invites').setDescription('Pause invites during a raid'))
        .addBooleanOption(option => option.setName('lock-channels').setDescription('Lock every channel during a raid'))
    )
    .addSubcommand(sub =>
      sub
        .setName('gate')
        .setDescription('Join gate rules checked on every join')
        .addIntegerOption(option => option.setName('min-age-days').setDescription('Minimum account age in days (0 turns off)').setMinValue(0).setMaxValue(365))
        .addStringOption(option => option.setName('age-action').setDescription('Action for accounts that are too new').addChoices(...ACTIONS))
        .addBooleanOption(option => option.setName('no-avatar').setDescription('Act on accounts with no avatar'))
        .addStringOption(option => option.setName('avatar-action').setDescription('Action for no avatar').addChoices(...ACTIONS))
        .addBooleanOption(option => option.setName('invite-names').setDescription('Act on usernames that advertise invites'))
        .addStringOption(option => option.setName('invite-action').setDescription('Action for invite usernames').addChoices(...ACTIONS))
    )
    .addSubcommand(sub =>
      sub
        .setName('risk')
        .setDescription('Risk scoring for every join')
        .addBooleanOption(option => option.setName('enabled').setDescription('Turn scoring on or off'))
        .addIntegerOption(option => option.setName('threshold').setDescription('Score that triggers the action').setMinValue(10).setMaxValue(500))
        .addStringOption(option => option.setName('action').setDescription('Action for risky joins').addChoices(...ACTIONS))
        .addIntegerOption(option => option.setName('age-bypass-days').setDescription('Accounts older than this skip scoring').setMinValue(0).setMaxValue(3650))
    )
    .addSubcommand(sub =>
      sub
        .setName('pattern')
        .setDescription('Blocked username patterns (regular expressions)')
        .addStringOption(option => option.setName('action').setDescription('What to do').setRequired(true).addChoices({ name: 'add', value: 'add' }, { name: 'remove', value: 'remove' }, { name: 'list', value: 'list' }, { name: 'set action', value: 'action' }))
        .addStringOption(option => option.setName('regex').setDescription('Pattern like ^free.?nitro (case-insensitive) or the action name for set action').setMaxLength(100))
    )
    .addSubcommand(sub => sub.setName('start').setDescription('Start raid mode manually'))
    .addSubcommand(sub => sub.setName('end').setDescription('End raid mode and resume invites'));
  kit.addConfigSubcommands(builder);
  return builder;
}

async function status(interaction) {
  const guild = interaction.guild;
  const config = (await store.loadConfig(guild.id))[MODULE];
  const stats = joinStats(guild.id, config.joinWindowSeconds);
  const lines = [
    `## ${em.raid} Anti-raid`,
    `${kit.onOff(config.enabled)} · ${isRaid(guild.id) ? `${em.error} **raid mode active**` : 'no raid right now'}`,
    `Trigger: **${config.joinThreshold}** joins in **${config.joinWindowSeconds}s** → **${config.raidAction}** for **${config.raidMinutes}** min`,
    `During a raid: punish recent joiners ${kit.onOff(config.punishRecentJoiners)} · pause invites ${kit.onOff(config.pauseInvites)} · lock channels ${kit.onOff(config.lockChannels)}`,
    `Join gate: min age **${config.minAccountAgeDays || 'off'}**${config.minAccountAgeDays ? ` days → ${config.minAccountAgeAction}` : ''} · no avatar ${kit.onOff(config.noAvatar)} → ${config.noAvatarAction} · invite names ${kit.onOff(config.blockInviteUsernames)} → ${config.inviteUsernameAction}`,
    `Patterns: **${config.usernamePatterns.length}** → ${config.usernamePatternAction}`,
    `Risk scoring: ${kit.onOff(config.riskEnabled)} · threshold **${config.riskThreshold}** → ${config.riskAction} · skips accounts older than ${config.ageBypassDays} days`,
    `Joins in the last ${config.joinWindowSeconds}s: **${stats.inWindow}** · last hour: **${stats.lastHour}**`
  ];
  await kit.send(interaction, lines);
}

async function applyMany(interaction, pairs) {
  const guildId = interaction.guild.id;
  const changes = pairs.filter(([, value]) => value !== null);
  if (!changes.length) {
    await kit.send(interaction, ['Nothing to change. Pass at least one option, or use `/antiraid status`.']);
    return;
  }
  for (const [key, value] of changes) {
    const result = await store.setValue(guildId, MODULE, key, String(value));
    if (!result.ok) {
      await kit.send(interaction, [`${em.error} Could not set ${key}.`]);
      return;
    }
  }
  await kit.send(interaction, [`${em.success} Updated ${changes.map(([key]) => `\`${key}\``).join(', ')}.`]);
}

async function pattern(interaction) {
  const guildId = interaction.guild.id;
  const action = interaction.options.getString('action');
  const regex = interaction.options.getString('regex');
  const config = (await store.loadConfig(guildId))[MODULE];

  if (action === 'list') {
    await kit.send(interaction, config.usernamePatterns.length ? kit.clip(['**Username patterns**', ...config.usernamePatterns.map(item => `• \`${item}\``)]) : ['No patterns yet.']);
    return;
  }
  if (!regex) {
    await kit.send(interaction, [`${em.error} Provide a value in the regex option.`]);
    return;
  }
  if (action === 'action') {
    await kit.applySet(interaction, MODULE, 'usernamePatternAction', regex);
    return;
  }
  if (action === 'add') {
    try {
      new RegExp(regex, 'i');
    } catch {
      await kit.send(interaction, [`${em.error} That is not a valid regular expression.`]);
      return;
    }
  }
  await kit.applyMutation(interaction, MODULE, 'usernamePatterns', regex, action === 'add');
}

module.exports = {
  data: data(),
  category: 'Security',
  usage: '/antiraid <status|enable|disable|threshold|action|gate|risk|pattern|start|end|view|set|add|remove|reset>',
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
    if (sub === 'enable' || sub === 'disable') {
      await store.setRaw(guild.id, MODULE, 'enabled', sub === 'enable');
      await kit.send(interaction, [sub === 'enable' ? `${em.success} Anti-raid is on.` : `${em.success} Anti-raid is off.`]);
      return;
    }
    if (sub === 'threshold') return applyMany(interaction, [['joinThreshold', o.getInteger('joins')], ['joinWindowSeconds', o.getInteger('seconds')]]);
    if (sub === 'action') {
      return applyMany(interaction, [['raidAction', o.getString('on-join')], ['raidMinutes', o.getInteger('minutes')], ['punishRecentJoiners', o.getBoolean('punish-recent')], ['pauseInvites', o.getBoolean('pause-invites')], ['lockChannels', o.getBoolean('lock-channels')]]);
    }
    if (sub === 'gate') {
      return applyMany(interaction, [['minAccountAgeDays', o.getInteger('min-age-days')], ['minAccountAgeAction', o.getString('age-action')], ['noAvatar', o.getBoolean('no-avatar')], ['noAvatarAction', o.getString('avatar-action')], ['blockInviteUsernames', o.getBoolean('invite-names')], ['inviteUsernameAction', o.getString('invite-action')]]);
    }
    if (sub === 'risk') {
      return applyMany(interaction, [['riskEnabled', o.getBoolean('enabled')], ['riskThreshold', o.getInteger('threshold')], ['riskAction', o.getString('action')], ['ageBypassDays', o.getInteger('age-bypass-days')]]);
    }
    if (sub === 'pattern') return pattern(interaction);
    if (sub === 'start') {
      if (isRaid(guild.id)) {
        await kit.send(interaction, [`${em.error} Raid mode is already active.`]);
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const config = (await store.loadConfig(guild.id))[MODULE];
      await startRaid(guild, config, []);
      await kit.send(interaction, [`${em.error} Raid mode started for **${config.raidMinutes}** minutes. End it with \`/antiraid end\`.`]);
      return;
    }
    if (sub === 'end') {
      if (!isRaid(guild.id)) {
        await kit.send(interaction, ['Raid mode is not active.']);
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      await endRaid(guild, interaction.user.id);
      await kit.send(interaction, [`${em.success} Raid mode ended.`]);
      return;
    }
    await kit.runConfigSubcommand(interaction, sub, MODULE);
  }
};

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { requireAccess } = require('../../../../lib/security/access');
const kit = require('../../../../lib/security/commandKit');
const store = require('../../../../lib/security/store');
const { isPanic } = require('../../../../lib/security/antinuke');
const { NUKE_EVENTS, PUNISHMENTS, DANGEROUS_DEFAULT } = require('../../../../config/security');
const { em } = require('../../../../lib/emojis');

const MODULE = 'antinuke';
const PUNISH_CHOICES = PUNISHMENTS.filter(item => item !== 'none').map(item => ({ name: item, value: item }));
const EVENT_PUNISH_CHOICES = ['default', ...PUNISHMENTS].map(item => ({ name: item, value: item }));

function data() {
  const builder = new SlashCommandBuilder()
    .setName('antinuke')
    .setDescription('Stop nukers: limits on deleting channels, roles, banning, and more')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub.setName('status').setDescription('Show anti-nuke settings and every watched event'))
    .addSubcommand(sub => sub.setName('enable').setDescription('Turn anti-nuke on'))
    .addSubcommand(sub => sub.setName('disable').setDescription('Turn anti-nuke off'))
    .addSubcommand(sub =>
      sub
        .setName('event')
        .setDescription('Tune one event: limit, window and punishment')
        .addStringOption(option => option.setName('event').setDescription('Which event').setAutocomplete(true).setRequired(true))
        .addBooleanOption(option => option.setName('enabled').setDescription('Watch this event'))
        .addIntegerOption(option => option.setName('limit').setDescription('Actions allowed in the window').setMinValue(1).setMaxValue(100))
        .addIntegerOption(option => option.setName('seconds').setDescription('Window length in seconds').setMinValue(1).setMaxValue(3600))
        .addStringOption(option => option.setName('punishment').setDescription('Punishment for this event').addChoices(...EVENT_PUNISH_CHOICES))
    )
    .addSubcommand(sub =>
      sub
        .setName('punishment')
        .setDescription('Default punishment and timeout length')
        .addStringOption(option => option.setName('type').setDescription('Default punishment').addChoices(...PUNISH_CHOICES))
        .addIntegerOption(option => option.setName('timeout-minutes').setDescription('Timeout length when punishment is timeout').setMinValue(1).setMaxValue(40320))
    )
    .addSubcommand(sub =>
      sub
        .setName('panic')
        .setDescription('What happens after someone is punished')
        .addBooleanOption(option => option.setName('on-trigger').setDescription('Lock the server when anti-nuke punishes someone'))
        .addIntegerOption(option => option.setName('minutes').setDescription('Panic mode length').setMinValue(1).setMaxValue(1440))
        .addBooleanOption(option => option.setName('revert').setDescription('Undo the damage after a trigger'))
    )
    .addSubcommand(sub =>
      sub
        .setName('bots')
        .setDescription('Who may add bots')
        .addStringOption(option =>
          option
            .setName('policy')
            .setDescription('Bot add policy')
            .setRequired(true)
            .addChoices({ name: 'trusted only', value: 'trusted' }, { name: 'nobody (kick every new bot)', value: 'nobody' }, { name: 'anyone', value: 'anyone' })
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('permissions')
        .setDescription('Edit which permissions count as dangerous')
        .addStringOption(option => option.setName('action').setDescription('Add or remove').setRequired(true).addChoices({ name: 'add', value: 'add' }, { name: 'remove', value: 'remove' }, { name: 'reset to default', value: 'reset' }))
        .addStringOption(option => option.setName('permission').setDescription('Permission name').setAutocomplete(true))
    );
  kit.addConfigSubcommands(builder);
  return builder;
}

async function status(interaction) {
  const config = (await store.loadConfig(interaction.guild.id)).antinuke;
  const lines = [
    `## ${em.nuke} Anti-nuke`,
    `${kit.onOff(config.enabled)} · default punishment **${config.punishment}** · revert ${kit.onOff(config.revert)} · bots: **${config.botAddPolicy}**`,
    `Panic on trigger ${kit.onOff(config.panicOnTrigger)} (${config.panicMinutes} min)${isPanic(interaction.guild.id) ? ` · ${em.error} active now` : ''}`,
    ''
  ];
  for (const event of NUKE_EVENTS) {
    const on = config[`${event.id}.enabled`];
    const punish = config[`${event.id}.punishment`];
    lines.push(`${on ? `${em.success}` : `${em.error}`} \`${event.id}\` ${config[`${event.id}.limit`]}/${config[`${event.id}.seconds`]}s → ${punish === 'default' ? config.punishment : punish}`);
  }
  lines.push('', '-# Tune one with `/antinuke event`. Trusted people are listed in `/security whitelist list`.');
  await kit.send(interaction, kit.clip(lines));
}

async function eventCommand(interaction) {
  const guildId = interaction.guild.id;
  const id = interaction.options.getString('event');
  const event = NUKE_EVENTS.find(item => item.id === id);
  if (!event) {
    await kit.send(interaction, [`${em.error} Unknown event. Start typing to pick one from the list.`]);
    return;
  }
  const changes = [
    ['enabled', interaction.options.getBoolean('enabled')],
    ['limit', interaction.options.getInteger('limit')],
    ['seconds', interaction.options.getInteger('seconds')],
    ['punishment', interaction.options.getString('punishment')]
  ].filter(([, value]) => value !== null);

  if (!changes.length) {
    const config = (await store.loadConfig(guildId))[MODULE];
    await kit.send(interaction, [`**${event.label}** (\`${id}\`)`, `${kit.onOff(config[`${id}.enabled`])} · ${config[`${id}.limit`]} actions per ${config[`${id}.seconds`]}s · punishment **${config[`${id}.punishment`]}**`]);
    return;
  }
  for (const [key, value] of changes) await store.setValue(guildId, MODULE, `${id}.${key}`, String(value));
  const config = (await store.loadConfig(guildId))[MODULE];
  await kit.send(interaction, [`${em.success} **${event.label}** — ${kit.onOff(config[`${id}.enabled`])} · ${config[`${id}.limit`]} per ${config[`${id}.seconds`]}s · punishment **${config[`${id}.punishment`]}**`]);
}

async function permissions(interaction) {
  const guildId = interaction.guild.id;
  const action = interaction.options.getString('action');
  const permission = interaction.options.getString('permission');
  if (action === 'reset') {
    await kit.applyReset(interaction, MODULE, 'dangerousPermissions');
    return;
  }
  if (!permission) {
    await kit.send(interaction, [`${em.error} Pick a permission.`]);
    return;
  }
  const valid = Object.keys(PermissionFlagsBits).find(name => name.toLowerCase() === permission.toLowerCase());
  if (!valid) {
    await kit.send(interaction, [`${em.error} That is not a Discord permission name.`]);
    return;
  }
  const config = (await store.loadConfig(guildId))[MODULE];
  const next = action === 'add' ? [...new Set([...config.dangerousPermissions, valid])] : config.dangerousPermissions.filter(item => item !== valid);
  await store.setRaw(guildId, MODULE, 'dangerousPermissions', next);
  await kit.send(interaction, [`${em.success} Dangerous permissions: ${next.map(item => `\`${item}\``).join(', ') || '*none*'}`]);
}

module.exports = {
  data: data(),
  category: 'Security',
  usage: '/antinuke <status|enable|disable|event|punishment|panic|bots|permissions|view|set|add|remove|reset>',
  async autocomplete(interaction) {
    if (!interaction.guild) return;
    const focused = interaction.options.getFocused(true);
    if (focused.name === 'event') {
      await interaction.respond(kit.pick(NUKE_EVENTS, focused.value, event => ({ name: `${event.label} (${event.id})`, value: event.id })));
      return;
    }
    if (focused.name === 'permission') {
      const names = Object.keys(PermissionFlagsBits);
      await interaction.respond(kit.pick(names, focused.value, name => ({ name: DANGEROUS_DEFAULT.includes(name) ? `${name} (default)` : name, value: name })));
      return;
    }
    await kit.configAutocomplete(interaction, MODULE);
  },
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (!(await requireAccess(interaction, 'config'))) return;
    const guildId = interaction.guild.id;

    if (sub === 'status') return status(interaction);
    if (sub === 'enable' || sub === 'disable') {
      await store.setRaw(guildId, MODULE, 'enabled', sub === 'enable');
      await kit.send(interaction, [sub === 'enable' ? `${em.success} Anti-nuke is on. Make sure my role is near the top of the role list.` : `${em.success} Anti-nuke is off.`]);
      return;
    }
    if (sub === 'event') return eventCommand(interaction);
    if (sub === 'permissions') return permissions(interaction);
    if (sub === 'bots') {
      await kit.applySet(interaction, MODULE, 'botAddPolicy', interaction.options.getString('policy'));
      return;
    }
    if (sub === 'punishment' || sub === 'panic') {
      const map = sub === 'punishment'
        ? [['punishment', interaction.options.getString('type')], ['timeoutMinutes', interaction.options.getInteger('timeout-minutes')]]
        : [['panicOnTrigger', interaction.options.getBoolean('on-trigger')], ['panicMinutes', interaction.options.getInteger('minutes')], ['revert', interaction.options.getBoolean('revert')]];
      const changes = map.filter(([, value]) => value !== null);
      for (const [key, value] of changes) await store.setValue(guildId, MODULE, key, String(value));
      const config = (await store.loadConfig(guildId))[MODULE];
      await kit.send(interaction, [changes.length ? `${em.success} Updated.` : 'Nothing changed.', `Punishment **${config.punishment}** (timeout ${config.timeoutMinutes} min) · panic ${kit.onOff(config.panicOnTrigger)} for ${config.panicMinutes} min · revert ${kit.onOff(config.revert)}`]);
      return;
    }
    await kit.runConfigSubcommand(interaction, sub, MODULE);
  }
};

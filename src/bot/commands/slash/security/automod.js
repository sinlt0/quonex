const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { requireAccess } = require('../../../../lib/security/access');
const kit = require('../../../../lib/security/commandKit');
const store = require('../../../../lib/security/store');
const { FILTERS } = require('../../../../config/security');
const { em } = require('../../../../lib/emojis');

const MODULE = 'automod';

function data() {
  const builder = new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Auto-moderation with a heat system, 13 filters and escalating strikes')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub.setName('status').setDescription('Show every filter and the punishment ladder'))
    .addSubcommand(sub => sub.setName('enable').setDescription('Turn auto-moderation on'))
    .addSubcommand(sub => sub.setName('disable').setDescription('Turn auto-moderation off'))
    .addSubcommand(sub =>
      sub
        .setName('filter')
        .setDescription('Configure one filter')
        .addStringOption(option => option.setName('filter').setDescription('Which filter').setAutocomplete(true).setRequired(true))
        .addBooleanOption(option => option.setName('enabled').setDescription('Turn the filter on or off'))
        .addIntegerOption(option => option.setName('threshold').setDescription('Its main limit (messages, mentions, percent, characters…)').setMinValue(1).setMaxValue(100000))
        .addIntegerOption(option => option.setName('heat').setDescription('Heat added per hit. 100 punishes at once').setMinValue(0).setMaxValue(100))
    )
    .addSubcommand(sub =>
      sub
        .setName('words')
        .setDescription('Blocked words (supports * wildcards)')
        .addStringOption(option => option.setName('action').setDescription('What to do').setRequired(true).addChoices({ name: 'add', value: 'add' }, { name: 'remove', value: 'remove' }, { name: 'list', value: 'list' }, { name: 'clear', value: 'clear' }))
        .addStringOption(option => option.setName('word').setDescription('Word or pattern, like bad*word').setMaxLength(60))
    )
    .addSubcommand(sub =>
      sub
        .setName('links')
        .setDescription('Link filter domains')
        .addStringOption(option => option.setName('action').setDescription('What to do').setRequired(true).addChoices({ name: 'add', value: 'add' }, { name: 'remove', value: 'remove' }, { name: 'list', value: 'list' }, { name: 'mode', value: 'mode' }))
        .addStringOption(option => option.setName('value').setDescription('Domain like example.com, or blocklist/allowlist for mode').setMaxLength(100))
    )
    .addSubcommand(sub =>
      sub
        .setName('punishment')
        .setDescription('Timeouts and strikes')
        .addIntegerOption(option => option.setName('timeout-minutes').setDescription('First timeout length').setMinValue(1).setMaxValue(40320))
        .addNumberOption(option => option.setName('multiplier').setDescription('Timeout growth on repeat offences').setMinValue(1).setMaxValue(10))
        .addIntegerOption(option => option.setName('max-timeout-minutes').setDescription('Longest timeout').setMinValue(1).setMaxValue(40320))
        .addIntegerOption(option => option.setName('strike-threshold').setDescription('Strikes before the strike action').setMinValue(1).setMaxValue(50))
        .addStringOption(option => option.setName('strike-action').setDescription('Action at the strike threshold').addChoices({ name: 'none', value: 'none' }, { name: 'kick', value: 'kick' }, { name: 'ban', value: 'ban' }))
        .addIntegerOption(option => option.setName('strike-reset-hours').setDescription('Hours without offences before strikes reset').setMinValue(1).setMaxValue(720))
    )
    .addSubcommand(sub =>
      sub
        .setName('behavior')
        .setDescription('Delete, notify and scan behavior')
        .addBooleanOption(option => option.setName('delete').setDescription('Delete offending messages'))
        .addBooleanOption(option => option.setName('notify').setDescription('Post a short notice on punishment'))
        .addBooleanOption(option => option.setName('scan-edits').setDescription('Check edited messages'))
        .addBooleanOption(option => option.setName('purge').setDescription('Delete recent messages of a punished member'))
        .addBooleanOption(option => option.setName('ignore-bots').setDescription('Skip bot messages'))
        .addIntegerOption(option => option.setName('base-heat').setDescription('Heat added by every message').setMinValue(0).setMaxValue(50))
        .addIntegerOption(option => option.setName('decay-seconds').setDescription('Seconds for 100 heat to cool down').setMinValue(5).setMaxValue(600))
    )
    .addSubcommand(sub =>
      sub
        .setName('strikes')
        .setDescription('See or clear a member\'s strikes')
        .addUserOption(option => option.setName('user').setDescription('Member').setRequired(true))
        .addBooleanOption(option => option.setName('clear').setDescription('Clear their strikes'))
    );
  kit.addConfigSubcommands(builder);
  return builder;
}

async function status(interaction) {
  const config = (await store.loadConfig(interaction.guild.id))[MODULE];
  const lines = [
    `## ${em.automod} Auto-mod`,
    `${kit.onOff(config.enabled)} · delete ${kit.onOff(config.deleteMessages)} · notify ${kit.onOff(config.notify)} · scan edits ${kit.onOff(config.scanEdits)}`,
    `Heat: **${config.baseHeat}** per message, cools in **${config.decaySeconds}s**. At 100 the member is punished.`,
    `Timeout: **${config.timeoutMinutes}** min × **${config.timeoutMultiplier}** per repeat, max **${config.maxTimeoutMinutes}** min`,
    `Strikes: **${config.strikeThreshold}** → **${config.strikeAction}** · reset after **${config.strikeResetHours}**h`,
    ''
  ];
  for (const filter of FILTERS) {
    const threshold = filter.thresholdKey ? ` · ${config[filter.thresholdKey]}` : '';
    lines.push(`${config[`${filter.id}.enabled`] ? `${em.success}` : `${em.error}`} \`${filter.id}\` ${filter.label}${threshold} · heat ${config[`${filter.id}.heat`]}`);
  }
  lines.push('', `Blocked words: **${config['words.list'].length}** · link list: **${config['links.list'].length}** (${config['links.mode']})`);
  await kit.send(interaction, kit.clip(lines));
}

async function filter(interaction) {
  const guildId = interaction.guild.id;
  const id = interaction.options.getString('filter');
  const item = FILTERS.find(entry => entry.id === id);
  if (!item) {
    await kit.send(interaction, [`${em.error} Unknown filter. Start typing to pick one.`]);
    return;
  }
  const enabled = interaction.options.getBoolean('enabled');
  const threshold = interaction.options.getInteger('threshold');
  const heat = interaction.options.getInteger('heat');

  if (threshold !== null && !item.thresholdKey) {
    await kit.send(interaction, [`${em.error} **${item.label}** has no threshold.`]);
    return;
  }
  if (enabled !== null) await store.setValue(guildId, MODULE, `${id}.enabled`, String(enabled));
  if (heat !== null) await store.setValue(guildId, MODULE, `${id}.heat`, String(heat));
  if (threshold !== null) {
    const result = await store.setValue(guildId, MODULE, item.thresholdKey, String(threshold));
    if (!result.ok) {
      await kit.send(interaction, [`${em.error} ${threshold} is outside the allowed range for this filter.`]);
      return;
    }
  }
  const config = (await store.loadConfig(guildId))[MODULE];
  const extras = item.extra.map(([key, , , , , label]) => `${label}: ${kit.formatValue({ type: typeof config[key] === 'boolean' ? 'bool' : Array.isArray(config[key]) ? 'list' : 'string' }, config[key])}`);
  await kit.send(interaction, [
    `${enabled !== null || heat !== null || threshold !== null ? `${em.success} ` : ''}**${item.label}** — ${kit.onOff(config[`${id}.enabled`])} · heat ${config[`${id}.heat`]}${item.thresholdKey ? ` · ${item.thresholdLabel}: ${config[item.thresholdKey]}` : ''}`,
    ...extras.map(line => `-# ${line}`),
    '-# More options for this filter are under `/automod view` with a search.'
  ]);
}

async function list(interaction, key, titleText, action, value) {
  const guildId = interaction.guild.id;
  const config = (await store.loadConfig(guildId))[MODULE];
  if (action === 'list') {
    const items = config[key];
    await kit.send(interaction, items.length ? kit.clip([`**${titleText}** (${items.length})`, ...items.map(item => `• \`${item}\``)]) : [`No ${titleText.toLowerCase()} yet.`]);
    return;
  }
  if (action === 'clear') {
    await store.setRaw(guildId, MODULE, key, []);
    await kit.send(interaction, [`${em.success} Cleared ${titleText.toLowerCase()}.`]);
    return;
  }
  if (!value) {
    await kit.send(interaction, [`${em.error} Provide a value.`]);
    return;
  }
  await kit.applyMutation(interaction, MODULE, key, value.toLowerCase(), action === 'add');
}

async function strikes(interaction) {
  const user = interaction.options.getUser('user');
  const guildId = interaction.guild.id;
  if (interaction.options.getBoolean('clear')) {
    await store.clearStrikes(guildId, user.id);
    await kit.send(interaction, [`${em.success} Cleared strikes for <@${user.id}>.`]);
    return;
  }
  const count = await store.getStrikes(guildId, user.id);
  const value = typeof count === 'object' && count !== null ? count.count || 0 : count || 0;
  await kit.send(interaction, [`<@${user.id}> has **${value}** strike${value === 1 ? '' : 's'}.`]);
}

module.exports = {
  data: data(),
  category: 'Security',
  usage: '/automod <status|enable|disable|filter|words|links|punishment|behavior|strikes|view|set|add|remove|reset>',
  async autocomplete(interaction) {
    if (!interaction.guild) return;
    const focused = interaction.options.getFocused(true);
    if (focused.name === 'filter') {
      await interaction.respond(kit.pick(FILTERS, focused.value, item => ({ name: `${item.label} (${item.id})`, value: item.id })));
      return;
    }
    await kit.configAutocomplete(interaction, MODULE);
  },
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (!(await requireAccess(interaction, 'config'))) return;
    const guildId = interaction.guild.id;
    const o = interaction.options;

    if (sub === 'status') return status(interaction);
    if (sub === 'enable' || sub === 'disable') {
      await store.setRaw(guildId, MODULE, 'enabled', sub === 'enable');
      await kit.send(interaction, [sub === 'enable' ? `${em.success} Auto-mod is on. Turn filters on with \`/automod filter\`.` : `${em.success} Auto-mod is off.`]);
      return;
    }
    if (sub === 'filter') return filter(interaction);
    if (sub === 'words') return list(interaction, 'words.list', 'Blocked words', o.getString('action'), o.getString('word'));
    if (sub === 'links') {
      const action = o.getString('action');
      if (action === 'mode') return kit.applySet(interaction, MODULE, 'links.mode', o.getString('value') || '');
      return list(interaction, 'links.list', 'Link domains', action, o.getString('value'));
    }
    if (sub === 'punishment' || sub === 'behavior') {
      const pairs = sub === 'punishment'
        ? [['timeoutMinutes', o.getInteger('timeout-minutes')], ['timeoutMultiplier', o.getNumber('multiplier')], ['maxTimeoutMinutes', o.getInteger('max-timeout-minutes')], ['strikeThreshold', o.getInteger('strike-threshold')], ['strikeAction', o.getString('strike-action')], ['strikeResetHours', o.getInteger('strike-reset-hours')]]
        : [['deleteMessages', o.getBoolean('delete')], ['notify', o.getBoolean('notify')], ['scanEdits', o.getBoolean('scan-edits')], ['purgeOnPunish', o.getBoolean('purge')], ['ignoreBots', o.getBoolean('ignore-bots')], ['baseHeat', o.getInteger('base-heat')], ['decaySeconds', o.getInteger('decay-seconds')]];
      const changes = pairs.filter(([, value]) => value !== null);
      if (!changes.length) {
        await kit.send(interaction, ['Pass at least one option to change something.']);
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
      return;
    }
    if (sub === 'strikes') return strikes(interaction);
    await kit.runConfigSubcommand(interaction, sub, MODULE);
  }
};

const { v2Message } = require('../components');
const { REGISTRY, MODULES, findEntry, keysFor, SECURITY_ERRORS } = require('../../config/security');
const { loadConfig, setValue, mutateList, resetConfig } = require('./store');
const { em } = require('../emojis');

const LIST_TYPES = ['list', 'rolelist', 'userlist'];

async function send(interaction, lines, options = {}) {
  const payload = v2Message(lines, { ephemeral: true, footer: false, allowedMentions: { parse: [] }, ...options });
  if (interaction.deferred || interaction.replied) return interaction.editReply(payload);
  return interaction.reply(payload);
}

function formatValue(entry, value) {
  if (value === undefined || value === null || value === '') return '*not set*';
  switch (entry.type) {
    case 'bool':
      return value ? 'on' : 'off';
    case 'role':
      return `<@&${value}>`;
    case 'channel':
      return `<#${value}>`;
    case 'rolelist':
      return value.length ? value.map(id => `<@&${id}>`).join(' ') : '*none*';
    case 'userlist':
      return value.length ? value.map(id => `<@${id}>`).join(' ') : '*none*';
    case 'list': {
      if (!value.length) return '*none*';
      const shown = value.slice(0, 8).map(item => `\`${item}\``).join(', ');
      return value.length > 8 ? `${shown} +${value.length - 8} more` : shown;
    }
    default:
      return `\`${String(value).slice(0, 80)}\``;
  }
}

function clip(lines, max = 3600) {
  const out = [];
  let size = 0;
  for (const line of lines) {
    size += line.length + 1;
    if (size > max) {
      out.push('…');
      break;
    }
    out.push(line);
  }
  return out;
}

async function showConfig(interaction, module, search, page) {
  const config = await loadConfig(interaction.guild.id);
  const term = (search || '').toLowerCase();
  const entries = keysFor(module).filter(entry => !term || entry.key.toLowerCase().includes(term) || entry.label.toLowerCase().includes(term));
  if (!entries.length) {
    await send(interaction, ['No settings match that search.']);
    return;
  }
  const perPage = 14;
  const pages = Math.max(1, Math.ceil(entries.length / perPage));
  const current = Math.min(Math.max(page || 1, 1), pages);
  const slice = entries.slice((current - 1) * perPage, current * perPage);
  const lines = [`**${module}** settings · page ${current}/${pages} · ${entries.length} match${entries.length === 1 ? '' : 'es'}`];
  for (const entry of slice) {
    lines.push(`\`${entry.key}\` = ${formatValue(entry, config[module][entry.key])}\n-# ${entry.label}`);
  }
  if (pages > 1) lines.push(`-# Use the page option to see more, or search to filter.`);
  await send(interaction, clip(lines));
}

function describeError(result, entry) {
  if (result.error === 'invalid-value') {
    const hints = [];
    if (entry) {
      hints.push(`type: ${entry.type}`);
      if (entry.options) hints.push(`options: ${entry.options.join(', ')}`);
      if (entry.min !== undefined && entry.max !== undefined) hints.push(`range: ${entry.min} to ${entry.max}`);
      if (entry.type === 'role' || entry.type === 'channel') hints.push('use a mention, an ID, or `none` to clear');
    }
    return `${SECURITY_ERRORS['invalid-value']}${hints.length ? ` (${hints.join(' · ')})` : ''}`;
  }
  return SECURITY_ERRORS[result.error] || 'Something went wrong.';
}

async function applySet(interaction, module, key, value) {
  const entry = findEntry(module, key);
  if (!entry) {
    await send(interaction, [`${em.error} ${SECURITY_ERRORS['unknown-key']}`]);
    return;
  }
  const result = await setValue(interaction.guild.id, module, key, value);
  if (!result.ok) {
    await send(interaction, [`${em.error} ${describeError(result, entry)}`]);
    return;
  }
  await send(interaction, [`${em.success} **${module}.${key}** is now ${formatValue(entry, result.value)}`]);
}

async function applyMutation(interaction, module, key, value, add) {
  const entry = findEntry(module, key);
  if (!entry) {
    await send(interaction, [`${em.error} ${SECURITY_ERRORS['unknown-key']}`]);
    return;
  }
  const result = await mutateList(interaction.guild.id, module, key, value, add);
  if (!result.ok) {
    await send(interaction, [`${em.error} ${describeError(result, entry)}`]);
    return;
  }
  await send(interaction, [`${em.success} ${add ? 'Added to' : 'Removed from'} **${module}.${key}** — now ${formatValue(entry, result.value)}`]);
}

async function applyReset(interaction, module, key) {
  const result = await resetConfig(interaction.guild.id, module, key || null);
  if (!result.ok) {
    await send(interaction, [`${em.error} ${SECURITY_ERRORS['unknown-key']}`]);
    return;
  }
  await send(interaction, [`${em.success} ${key ? `**${module}.${key}** was reset to its default.` : `All **${module}** settings were reset to their defaults.`}`]);
}

function addConfigSubcommands(builder, { withModule = false, moduleChoices = MODULES } = {}) {
  const moduleOption = option =>
    option
      .setName('module')
      .setDescription('Which part of the security suite')
      .setRequired(true)
      .addChoices(...moduleChoices.map(name => ({ name, value: name })));

  const keyOption = (option, required = true) => option.setName('key').setDescription('Setting name').setAutocomplete(true).setRequired(required);

  const withMod = sub => (withModule ? sub.addStringOption(moduleOption) : sub);

  builder.addSubcommand(sub =>
    withMod(sub.setName('view').setDescription('Show settings'))
      .addStringOption(option => option.setName('search').setDescription('Only show settings containing this text'))
      .addIntegerOption(option => option.setName('page').setDescription('Page number').setMinValue(1).setMaxValue(60))
  );
  builder.addSubcommand(sub =>
    withMod(sub.setName('set').setDescription('Change any setting'))
      .addStringOption(option => keyOption(option))
      .addStringOption(option => option.setName('value').setDescription('New value (on/off, number, option, mention or ID)').setAutocomplete(true).setRequired(true))
  );
  builder.addSubcommand(sub =>
    withMod(sub.setName('add').setDescription('Add an item to a list setting'))
      .addStringOption(option => keyOption(option))
      .addStringOption(option => option.setName('value').setDescription('Item to add').setRequired(true))
  );
  builder.addSubcommand(sub =>
    withMod(sub.setName('remove').setDescription('Remove an item from a list setting'))
      .addStringOption(option => keyOption(option))
      .addStringOption(option => option.setName('value').setDescription('Item to remove').setRequired(true))
  );
  builder.addSubcommand(sub =>
    withMod(sub.setName('reset').setDescription('Reset one setting, or the whole module, to defaults'))
      .addStringOption(option => keyOption(option, false))
  );
  return builder;
}

async function runConfigSubcommand(interaction, sub, fixedModule) {
  const module = fixedModule || interaction.options.getString('module');
  if (sub === 'view') {
    await showConfig(interaction, module, interaction.options.getString('search'), interaction.options.getInteger('page'));
    return true;
  }
  if (sub === 'set') {
    await applySet(interaction, module, interaction.options.getString('key'), interaction.options.getString('value'));
    return true;
  }
  if (sub === 'add' || sub === 'remove') {
    await applyMutation(interaction, module, interaction.options.getString('key'), interaction.options.getString('value'), sub === 'add');
    return true;
  }
  if (sub === 'reset') {
    await applyReset(interaction, module, interaction.options.getString('key'));
    return true;
  }
  return false;
}

function pick(list, text, map) {
  const term = (text || '').toLowerCase();
  return list
    .filter(item => !term || map(item).name.toLowerCase().includes(term) || String(map(item).value).toLowerCase().includes(term))
    .slice(0, 25)
    .map(item => {
      const choice = map(item);
      return { name: choice.name.slice(0, 100), value: String(choice.value).slice(0, 100) };
    });
}

async function configAutocomplete(interaction, fixedModule) {
  const focused = interaction.options.getFocused(true);
  const module = fixedModule || interaction.options.getString('module');
  let sub = null;
  try {
    sub = interaction.options.getSubcommand(false);
  } catch {
    sub = null;
  }

  if (focused.name === 'key') {
    const entries = module ? keysFor(module) : REGISTRY;
    const filtered = ['add', 'remove'].includes(sub) ? entries.filter(entry => LIST_TYPES.includes(entry.type)) : entries;
    await interaction.respond(pick(filtered, focused.value, entry => ({ name: `${module ? '' : `${entry.module}.`}${entry.key} — ${entry.label}`, value: entry.key })));
    return true;
  }

  if (focused.name === 'value' && sub === 'set') {
    const entry = findEntry(module, interaction.options.getString('key') || '');
    let options = [];
    if (entry) {
      if (entry.type === 'bool') options = ['on', 'off'];
      else if (entry.type === 'enum') options = entry.options;
      else if (entry.type === 'role' || entry.type === 'channel') options = ['none'];
    }
    await interaction.respond(pick(options, focused.value, item => ({ name: item, value: item })));
    return true;
  }

  if (focused.name === 'value' && ['add', 'remove'].includes(sub)) {
    const entry = findEntry(module, interaction.options.getString('key') || '');
    const options = entry && entry.options ? entry.options : [];
    await interaction.respond(pick(options, focused.value, item => ({ name: item, value: item })));
    return true;
  }

  return false;
}

function onOff(value) {
  return value ? `${em.on} on` : `${em.off} off`;
}

module.exports = {
  send,
  formatValue,
  showConfig,
  applySet,
  applyMutation,
  applyReset,
  addConfigSubcommands,
  runConfigSubcommand,
  configAutocomplete,
  pick,
  onOff,
  clip
};

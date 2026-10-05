const { StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { v2Message, SEPARATOR } = require('./components');
const { SUPPORT_SERVER, BOT_NAME } = require('../config/branding');
const { COMMANDS_PER_PAGE, HELP_HIDDEN_CATEGORIES, CATEGORY_DESCRIPTIONS } = require('../config/help');

function addEntry(map, category, entry, hidden, privileged) {
  if (hidden && !privileged) return;
  if (HELP_HIDDEN_CATEGORIES.includes(category) && !privileged) return;
  if (!map.has(category)) map.set(category, []);
  map.get(category).push(entry);
}

function collectCommands(client, textCommands, privileged) {
  const slash = new Map();
  const text = new Map();

  for (const command of client.commands.values()) {
    addEntry(
      slash,
      command.category || 'General',
      {
        name: command.data.name,
        description: command.data.description || 'No description provided.',
        usage: command.usage || `/${command.data.name}`
      },
      Boolean(command.hidden),
      privileged
    );
  }

  for (const command of textCommands.values()) {
    addEntry(
      text,
      command.category || 'General',
      {
        name: command.name,
        description: command.description || 'No description provided.',
        usage: command.usage || command.name
      },
      Boolean(command.hidden),
      privileged
    );
  }

  return { slash, text };
}

function findCommand(categories, name) {
  for (const map of [categories.slash, categories.text]) {
    for (const commands of map.values()) {
      const match = commands.find(command => command.name === name);
      if (match) return match;
    }
  }
  return null;
}

function paginate(lines, perPage) {
  const pages = [];
  for (let i = 0; i < lines.length; i += perPage) {
    pages.push(lines.slice(i, i + perPage));
  }
  return pages.length ? pages : [['No commands in this category.']];
}

function categoryDescription(category, count) {
  return CATEGORY_DESCRIPTIONS[category] || `${count} command${count === 1 ? '' : 's'}.`;
}

function typeLabel(type) {
  return type === 'slash' ? 'Slash Commands' : 'Prefix Commands';
}

function homeSectionLines(type, map) {
  const lines = [`**${typeLabel(type)}**`];
  if (!map.size) {
    lines.push('No commands available.');
    return lines;
  }
  for (const [category, commands] of map) {
    lines.push(`**${category}** — ${categoryDescription(category, commands.length)}`);
  }
  return lines;
}

function homeLines(categories) {
  return [
    `## ${BOT_NAME} Help`,
    'Pick a category from either dropdown below.',
    SEPARATOR,
    ...homeSectionLines('slash', categories.slash),
    SEPARATOR,
    ...homeSectionLines('text', categories.text)
  ];
}

function categoryPageLines(type, category, page, pageIndex, pageCount) {
  const lines = [`## ${typeLabel(type)} — ${category}`, SEPARATOR];
  for (const command of page) {
    lines.push(`\`${command.usage}\` — ${command.description}`);
  }
  if (pageCount > 1) {
    lines.push(SEPARATOR, `*Page ${pageIndex + 1}/${pageCount}*`);
  }
  return lines;
}

function commandLines(command) {
  return [`## ${command.name}`, SEPARATOR, command.description, `Usage: \`${command.usage}\``];
}

function buildTypeSelect(type, map, activeType, activeCategory, disabled) {
  const options = [...map.keys()].map(category => ({
    label: category,
    value: category,
    default: type === activeType && category === activeCategory
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId(`help_${type}_select`)
    .setPlaceholder(type === 'slash' ? 'Slash command category...' : 'Prefix command category...')
    .setDisabled(Boolean(disabled) || options.length === 0)
    .addOptions(options.length ? options : [{ label: 'No categories available', value: '__none__' }]);

  return new ActionRowBuilder().addComponents(select);
}

function buildNavRow(stage, pageIndex, pageCount, disabled) {
  const home = new ButtonBuilder()
    .setCustomId('help_home')
    .setLabel('Home')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(Boolean(disabled) || stage === 'home');

  const prev = new ButtonBuilder()
    .setCustomId('help_prev')
    .setLabel('◀')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(Boolean(disabled) || stage === 'home' || pageIndex <= 0);

  const next = new ButtonBuilder()
    .setCustomId('help_next')
    .setLabel('▶')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(Boolean(disabled) || stage === 'home' || pageIndex >= pageCount - 1);

  const support = new ButtonBuilder()
    .setLabel('Support Server')
    .setStyle(ButtonStyle.Link)
    .setURL(SUPPORT_SERVER)
    .setDisabled(Boolean(disabled));

  return new ActionRowBuilder().addComponents(home, prev, next, support);
}

function buildHomePayload(categories, disabled) {
  return v2Message(homeLines(categories), {
    extraComponents: [
      buildTypeSelect('slash', categories.slash, null, null, disabled),
      buildTypeSelect('text', categories.text, null, null, disabled),
      buildNavRow('home', 0, 1, disabled)
    ]
  });
}

function buildCategoryPayload(categories, type, category, pageIndex, disabled) {
  const map = categories[type];
  const commands = map.get(category) || [];
  const pages = paginate(commands, COMMANDS_PER_PAGE);
  const safeIndex = Math.min(pageIndex, pages.length - 1);

  return v2Message(categoryPageLines(type, category, pages[safeIndex], safeIndex, pages.length), {
    extraComponents: [
      buildTypeSelect('slash', categories.slash, type, category, disabled),
      buildTypeSelect('text', categories.text, type, category, disabled),
      buildNavRow('category', safeIndex, pages.length, disabled)
    ]
  });
}

function buildCommandPayload(command) {
  return v2Message(commandLines(command));
}

function buildNotFoundPayload(query) {
  return v2Message([`## Not Found`, `No command or category named \`${query}\` found.`]);
}

function attachCollector(sent, userId, categories) {
  let stage = 'home';
  let activeType = null;
  let activeCategory = null;
  let pageIndex = 0;

  const collector = sent.createMessageComponentCollector({ time: 120000 });

  collector.on('collect', async componentInteraction => {
    if (componentInteraction.user.id !== userId) {
      await componentInteraction.reply({ content: 'This help menu is not for you.', ephemeral: true });
      return;
    }

    if (componentInteraction.customId === 'help_slash_select' || componentInteraction.customId === 'help_text_select') {
      const value = componentInteraction.values[0];
      if (value === '__none__') {
        await componentInteraction.deferUpdate();
        return;
      }
      activeType = componentInteraction.customId === 'help_slash_select' ? 'slash' : 'text';
      activeCategory = value;
      pageIndex = 0;
      stage = 'category';
      await componentInteraction.update(buildCategoryPayload(categories, activeType, activeCategory, pageIndex));
    } else if (componentInteraction.customId === 'help_home') {
      stage = 'home';
      activeType = null;
      activeCategory = null;
      pageIndex = 0;
      await componentInteraction.update(buildHomePayload(categories));
    } else if (componentInteraction.customId === 'help_prev') {
      pageIndex -= 1;
      await componentInteraction.update(buildCategoryPayload(categories, activeType, activeCategory, pageIndex));
    } else if (componentInteraction.customId === 'help_next') {
      pageIndex += 1;
      await componentInteraction.update(buildCategoryPayload(categories, activeType, activeCategory, pageIndex));
    }
  });

  collector.on('end', () => {
    const payload = stage === 'category'
      ? buildCategoryPayload(categories, activeType, activeCategory, pageIndex, true)
      : buildHomePayload(categories, true);
    sent.edit(payload).catch(() => {});
  });
}

module.exports = { collectCommands, findCommand, buildHomePayload, buildCommandPayload, buildNotFoundPayload, attachCollector };

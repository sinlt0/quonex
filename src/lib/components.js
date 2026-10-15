const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags
} = require('discord.js');
const { CREDIT } = require('../config/branding');

const MAX_BUTTONS_PER_ROW = 5;
const MAX_IMAGES_PER_GALLERY = 10;

const SEPARATOR = Symbol('separator');

const STYLE_MAP = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
  link: ButtonStyle.Link
};

function textContainer(lines, options = {}) {
  const container = new ContainerBuilder();
  if (options.color !== undefined) container.setAccentColor(options.color);

  for (const line of lines) {
    if (line === SEPARATOR) {
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      continue;
    }
    const content = line === '' ? '\u200B' : line;
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
  }

  if (options.extraComponents && options.extraComponents.length) {
    container.addActionRowComponents(...options.extraComponents);
  }

  if (options.imageUrl) {
    const gallery = new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(options.imageUrl));
    container.addMediaGalleryComponents(gallery);
  }

  if (options.footer !== false) {
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${CREDIT}`));
  }

  return container;
}

function v2Message(lines, options = {}) {
  const container = textContainer(lines, options);
  const payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
  if (options.ephemeral) payload.flags |= MessageFlags.Ephemeral;
  if (options.allowedMentions) payload.allowedMentions = options.allowedMentions;
  if (options.files) payload.files = options.files;
  return payload;
}

function addBlockToContainer(container, block, context = {}) {
  if (!block || typeof block !== 'object') return;

  switch (block.type) {
    case 'text': {
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(block.content || '​'));
      break;
    }
    case 'separator': {
      container.addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(block.divider !== false)
          .setSpacing(block.spacing === 'large' ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small)
      );
      break;
    }
    case 'image': {
      const urls = Array.isArray(block.urls) ? block.urls : block.url ? [block.url] : [];
      const items = urls.filter(Boolean).slice(0, MAX_IMAGES_PER_GALLERY).map(url => new MediaGalleryItemBuilder().setURL(url));
      if (!items.length) break;
      container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(...items));
      break;
    }
    case 'section': {
      if (!block.thumbnail) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(block.content || '​'));
        break;
      }
      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(block.content || '​'))
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(block.thumbnail))
      );
      break;
    }
    case 'footer': {
      container.addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(block.divider !== false)
          .setSpacing(block.spacing === 'large' ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small)
      );
      const content = block.content || '';
      const prefixed = content.startsWith('-#') ? content : `-# ${content}`;
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content ? prefixed : '​'));
      break;
    }
    case 'buttons': {
      const buttons = (block.buttons || []).filter(item => item && item.url && item.label).slice(0, MAX_BUTTONS_PER_ROW);
      if (!buttons.length) break;
      const row = new ActionRowBuilder().addComponents(
        buttons.map(item => {
          const button = new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(item.url).setLabel(item.label.slice(0, 80));
          if (item.emoji) button.setEmoji(item.emoji);
          return button;
        })
      );
      container.addActionRowComponents(row);
      break;
    }
    case 'actions': {
      const items = (block.buttons || []).slice(0, MAX_BUTTONS_PER_ROW);
      if (!items.length) break;
      const messageId = context.messageId || 'preview';
      const row = new ActionRowBuilder().addComponents(
        items.map(item => {
          const style = STYLE_MAP[item.style] || ButtonStyle.Secondary;
          const button = new ButtonBuilder().setStyle(style).setLabel(String(item.label || '-').slice(0, 80));
          if (style === ButtonStyle.Link) button.setURL(item.url);
          else button.setCustomId(`im:${messageId}:${item.id}`);
          if (item.emoji) button.setEmoji(item.emoji);
          return button;
        })
      );
      container.addActionRowComponents(row);
      break;
    }
    case 'select': {
      const options = (block.options || []).slice(0, 25);
      if (!options.length) break;
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`im:${context.messageId || 'preview'}:${block.id}`)
        .setMinValues(Math.min(block.minValues || 1, options.length))
        .setMaxValues(Math.min(block.maxValues || (block.multi ? options.length : 1), options.length))
        .addOptions(
          options.map(item => {
            const option = new StringSelectMenuOptionBuilder().setLabel(String(item.label).slice(0, 80)).setValue(item.id);
            if (item.description) option.setDescription(item.description.slice(0, 100));
            if (item.emoji) option.setEmoji(item.emoji);
            return option;
          })
        );
      if (block.placeholder) menu.setPlaceholder(block.placeholder.slice(0, 150));
      container.addActionRowComponents(new ActionRowBuilder().addComponents(menu));
      break;
    }
    default:
      break;
  }
}

function blocksContainer(blocks, options = {}) {
  const container = new ContainerBuilder();
  if (options.color !== undefined) container.setAccentColor(options.color);

  for (const block of blocks || []) {
    addBlockToContainer(container, block, options.context);
  }

  if (options.footer !== false) {
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${CREDIT}`));
  }

  return container;
}

function blocksMessage(blocks, options = {}) {
  const container = blocksContainer(blocks, options);
  const payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
  if (options.ephemeral) payload.flags |= MessageFlags.Ephemeral;
  if (options.allowedMentions) payload.allowedMentions = options.allowedMentions;
  if (options.files) payload.files = options.files;
  return payload;
}

module.exports = { textContainer, v2Message, blocksContainer, blocksMessage, addBlockToContainer, MAX_BUTTONS_PER_ROW, SEPARATOR };

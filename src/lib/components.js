const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const { CREDIT } = require('../config/branding');

const SEPARATOR = Symbol('separator');

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
  return payload;
}

module.exports = { textContainer, v2Message, SEPARATOR };

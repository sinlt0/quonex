const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  MessageFlags
} = require('discord.js');
const { v2Message } = require('../components');

const TIMEOUT = 15 * 60 * 1000;
const CREATE = '__create__';

function visible(item, answers) {
  return item.show ? Boolean(item.show(answers)) : true;
}

function visibleSteps(def, answers) {
  return def.steps.map((step, index) => index).filter(index => visible(def.steps[index], answers));
}

function text(content) {
  return new TextDisplayBuilder().setContent(content);
}

function clip(value, length) {
  const content = String(value);
  return content.length > length ? `${content.slice(0, length - 1)}…` : content;
}

function describeValue(field, value) {
  if (field.type === 'bool') return value ? 'on' : 'off';
  if (field.type === 'channel') return value === CREATE ? `a new channel (${field.create})` : value ? `<#${value}>` : '*none*';
  if (field.type === 'role') return value ? `<@&${value}>` : '*none*';
  if (field.type === 'select') {
    const picked = Array.isArray(value) ? value : [value];
    const labels = picked.map(item => (field.options.find(option => option.value === item) || { label: item }).label);
    return labels.length ? labels.join(', ') : '*none*';
  }
  return value ? `\`${clip(value, 60)}\`` : '*not set*';
}

function fieldRows(field, answers) {
  const value = answers[field.key];
  const id = `wz:${field.key}`;

  if (field.type === 'select') {
    const picked = new Set(Array.isArray(value) ? value : [value]);
    const menu = new StringSelectMenuBuilder()
      .setCustomId(id)
      .setPlaceholder(field.placeholder || 'Choose')
      .setMinValues(field.multi ? 0 : 1)
      .setMaxValues(field.multi ? field.options.length : 1)
      .addOptions(
        field.options.map(option => ({
          label: clip(option.label, 100),
          value: option.value,
          description: option.description ? clip(option.description, 100) : undefined,
          default: picked.has(option.value)
        }))
      );
    return [new ActionRowBuilder().addComponents(menu)];
  }

  if (field.type === 'bool') {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${id}:1`).setLabel('On').setStyle(value ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`${id}:0`).setLabel('Off').setStyle(!value ? ButtonStyle.Danger : ButtonStyle.Secondary)
      )
    ];
  }

  if (field.type === 'channel') {
    const menu = new ChannelSelectMenuBuilder()
      .setCustomId(id)
      .setPlaceholder(field.placeholder || 'Choose a channel')
      .setMinValues(0)
      .setMaxValues(1)
      .setChannelTypes(field.types || [ChannelType.GuildText]);
    if (value && value !== CREATE) menu.setDefaultChannels([value]);
    const rows = [new ActionRowBuilder().addComponents(menu)];
    if (field.create) {
      rows.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`${id}:create`).setLabel(`Create ${field.create} for me`).setStyle(value === CREATE ? ButtonStyle.Success : ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`${id}:clear`).setLabel('Clear').setStyle(ButtonStyle.Secondary)
        )
      );
    }
    return rows;
  }

  if (field.type === 'role') {
    const menu = new RoleSelectMenuBuilder().setCustomId(id).setPlaceholder(field.placeholder || 'Choose a role').setMinValues(0).setMaxValues(1);
    if (value) menu.setDefaultRoles([value]);
    return [new ActionRowBuilder().addComponents(menu)];
  }

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${id}:text`).setLabel(value ? 'Change' : 'Set').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`${id}:clear`).setLabel('Clear').setStyle(ButtonStyle.Secondary).setDisabled(!value)
    )
  ];
}

function render(def, index, answers, state, initial) {
  const steps = visibleSteps(def, answers);
  const step = def.steps[index];
  const position = steps.indexOf(index) + 1;
  const container = new ContainerBuilder().setAccentColor(def.color || 0x6f5de0);

  container.addTextDisplayComponents(text(`### ${def.title}`), text(`-# Step ${position} of ${steps.length} · ${step.title}`));
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  if (step.text) container.addTextDisplayComponents(text(step.text));

  if (step.review) {
    container.addTextDisplayComponents(text(def.summary(answers).join('\n')));
  } else {
    for (const field of step.fields.filter(item => visible(item, answers))) {
      const head = `**${field.label}**${field.description ? `\n-# ${field.description}` : ''}\nCurrent: ${describeValue(field, answers[field.key])}`;
      container.addTextDisplayComponents(text(head));
      for (const row of fieldRows(field, answers)) container.addActionRowComponents(row);
    }
  }

  if (state.error) container.addTextDisplayComponents(text(`⚠ ${state.error}`));

  const last = position === steps.length;
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('wz:__back').setLabel('Back').setStyle(ButtonStyle.Secondary).setDisabled(position === 1),
      last
        ? new ButtonBuilder().setCustomId('wz:__apply').setLabel(def.applyLabel || 'Apply').setStyle(ButtonStyle.Success)
        : new ButtonBuilder().setCustomId('wz:__next').setLabel('Next').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('wz:__cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
    )
  );

  const payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
  if (initial) payload.flags |= MessageFlags.Ephemeral;
  return payload;
}

function finalMessage(lines) {
  return v2Message(lines, { ephemeral: true, footer: false, allowedMentions: { parse: [] } });
}

function neighbor(def, answers, index, direction) {
  const steps = visibleSteps(def, answers);
  const next = steps[steps.indexOf(index) + direction];
  return next === undefined ? index : next;
}

async function runWizard(interaction, def) {
  const answers = { ...(await def.initial()) };
  const state = { error: null };
  let index = visibleSteps(def, answers)[0];
  const user = interaction.user;

  let sent;
  if (interaction.replied || interaction.deferred) {
    sent = await interaction.followUp(render(def, index, answers, state, true));
  } else {
    await interaction.reply(render(def, index, answers, state, true));
    sent = await interaction.fetchReply();
  }

  const collector = sent.createMessageComponentCollector({ filter: item => item.user.id === user.id, time: TIMEOUT });
  let finished = false;

  async function handle(item) {
    const part = item.customId.slice(3);

    if (part === '__cancel') {
      finished = true;
      collector.stop('cancel');
      await item.update(finalMessage(['Setup cancelled. Nothing was changed.']));
      return;
    }

    if (part === '__back') {
      state.error = null;
      index = neighbor(def, answers, index, -1);
      await item.update(render(def, index, answers, state));
      return;
    }

    if (part === '__next') {
      const step = def.steps[index];
      const problem = step.validate ? step.validate(answers) : null;
      if (problem) {
        state.error = problem;
        await item.update(render(def, index, answers, state));
        return;
      }
      state.error = null;
      index = neighbor(def, answers, index, 1);
      await item.update(render(def, index, answers, state));
      return;
    }

    if (part === '__apply') {
      finished = true;
      collector.stop('applied');
      await item.update(finalMessage(['Applying your choices...']));
      let result;
      try {
        result = await def.apply(answers, { interaction, guild: interaction.guild, user });
      } catch (error) {
        console.error('Setup wizard failed:', error);
        result = { lines: ['Something went wrong while applying the setup. Some steps may have completed. Run it again to finish.'] };
      }
      await item.editReply(finalMessage(result.lines)).catch(() => {});
      if (def.after) await def.after(answers, interaction).catch(error => console.error('Wizard follow-up failed:', error));
      return;
    }

    const [key, action] = part.split(':');
    const step = def.steps[index];
    const field = (step.fields || []).find(entry => entry.key === key);
    if (!field) {
      await item.deferUpdate();
      return;
    }

    if (action === 'text') {
      const modalId = `wz:modal:${key}:${item.id}`;
      const max = field.max || 100;
      const modal = new ModalBuilder()
        .setCustomId(modalId)
        .setTitle(clip(field.label, 45))
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('v').setLabel(clip(field.modalLabel || field.label, 45)).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(max).setValue(clip(answers[key] || '', max))
          )
        );
      await item.showModal(modal);
      const submitted = await item.awaitModalSubmit({ time: 120000, filter: entry => entry.customId === modalId && entry.user.id === user.id }).catch(() => null);
      if (!submitted) return;
      answers[key] = submitted.fields.getTextInputValue('v').trim();
      state.error = null;
      await submitted.update(render(def, index, answers, state));
      return;
    }

    if (action === 'clear') answers[key] = '';
    else if (action === 'create') answers[key] = CREATE;
    else if (field.type === 'bool') answers[key] = action === '1';
    else if (field.type === 'select') answers[key] = field.multi ? item.values : item.values[0];
    else answers[key] = item.values[0] || '';

    if (def.onChange) def.onChange(key, answers);
    state.error = null;
    await item.update(render(def, index, answers, state));
  }

  collector.on('collect', item => {
    handle(item).catch(error => console.error('Wizard step failed:', error));
  });
  collector.on('end', (collected, reason) => {
    if (finished || reason !== 'time') return;
    interaction.editReply(finalMessage(['Setup timed out. Nothing was changed. Run the command again to restart.'])).catch(() => {});
  });
}

module.exports = { runWizard, CREATE };

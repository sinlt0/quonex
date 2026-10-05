const { ChannelType, PermissionFlagsBits } = require('discord.js');
const {
  createPanel,
  deletePanel,
  listPanels,
  setTranscriptChannel,
  addStaffRole,
  removeStaffRole,
  addPanelCategory,
  removePanelCategory,
  addQuestion,
  removeQuestion,
  limitFor
} = require('../../../../lib/tickets');
const { isDev } = require('../../../../lib/permissions');
const { em } = require('../../../../lib/emojis');
const { supportLine } = require('../../../../lib/support');
const { v2Message, SEPARATOR } = require('../../../../lib/components');
const { ERROR_MESSAGES } = require('../../../../config/tickets');

const MENTION_PATTERN = /<#\d+>|<@&\d+>/g;

module.exports = {
  name: 'panel',
  category: 'Tickets',
  description: 'Manage ticket panels',
  usage: 'panel <create|delete|list|transcript|addstaffrole|removestaffrole|addcategory|removecategory|addquestion|removequestion|questions>',
  async execute(message, args) {
    if (!message.guild) return;

    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !isDev(message.author.id)) {
      await message.reply(v2Message([`${em.error} You need the Manage Server permission to manage panels.`, supportLine()]));
      return;
    }

    const sub = args[0];
    const guildId = message.guild.id;

    if (sub === 'create') {
      const category = message.mentions.channels.find(channel => channel.type === ChannelType.GuildCategory);
      const staffRole = message.mentions.roles.first();
      const targetChannel = message.mentions.channels.find(channel => channel.type === ChannelType.GuildText) || message.channel;

      if (!category) {
        await message.reply(
          v2Message([`${em.error} ${ERROR_MESSAGES['category-missing']}`, 'Usage: panel create #category @StaffRole <name>'])
        );
        return;
      }
      if (!staffRole) {
        await message.reply(v2Message([`${em.error} Mention a staff role.`, 'Usage: panel create #category @StaffRole <name>']));
        return;
      }

      const name = args.slice(1).join(' ').replace(MENTION_PATTERN, '').trim() || 'Support';

      const result = await createPanel({
        guildId,
        name,
        categoryId: category.id,
        channelId: targetChannel.id,
        staffRoleId: staffRole.id,
        createdBy: message.author.id,
        targetChannel
      });

      if (!result.ok) {
        await message.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`, supportLine()]));
        return;
      }

      await message.reply(
        v2Message([`${em.success} Panel **${result.panel.name}** created in ${targetChannel} (ID: \`${result.panel.id}\`)`])
      );
    } else if (sub === 'delete') {
      const panelId = args[1];
      if (!panelId) {
        await message.reply(v2Message([`${em.error} Usage: panel delete <panelid>`]));
        return;
      }

      const result = await deletePanel(guildId, panelId, message.client);
      if (!result.ok) {
        await message.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`]));
        return;
      }

      await message.reply(v2Message([`${em.success} Panel **${result.panel.name}** deleted.`]));
    } else if (sub === 'list') {
      const panels = await listPanels(guildId);
      if (!panels.length) {
        await message.reply(v2Message([`${em.arrow} No panels have been created yet.`]));
        return;
      }

      const lines = panels.map(
        panel =>
          `\`${panel.id}\` — **${panel.name}** (${panel.categoryIds.length} categor${panel.categoryIds.length === 1 ? 'y' : 'ies'})`
      );
      await message.reply(v2Message(['**Ticket Panels**', SEPARATOR, ...lines]));
    } else if (sub === 'transcript') {
      const panelId = args[1];
      const channel = message.mentions.channels.first();

      if (!panelId || !channel) {
        await message.reply(v2Message([`${em.error} Usage: panel transcript <panelid> #channel`]));
        return;
      }

      const result = await setTranscriptChannel(guildId, panelId, channel.id);
      if (!result.ok) {
        await message.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`]));
        return;
      }

      await message.reply(v2Message([`${em.success} Transcripts for that panel will be sent to ${channel}.`]));
    } else if (sub === 'addstaffrole') {
      const panelId = args[1];
      const role = message.mentions.roles.first();

      if (!panelId || !role) {
        await message.reply(v2Message([`${em.error} Usage: panel addstaffrole <panelid> @Role`]));
        return;
      }

      const result = await addStaffRole({ guild: message.guild, panelId, roleId: role.id });
      if (!result.ok) {
        await message.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`]));
        return;
      }

      await message.reply(v2Message([`${em.success} ${role} added as a staff role for that panel.`]));
    } else if (sub === 'removestaffrole') {
      const panelId = args[1];
      const role = message.mentions.roles.first();

      if (!panelId || !role) {
        await message.reply(v2Message([`${em.error} Usage: panel removestaffrole <panelid> @Role`]));
        return;
      }

      const result = await removeStaffRole({ guild: message.guild, panelId, roleId: role.id });
      if (!result.ok) {
        await message.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`]));
        return;
      }

      await message.reply(v2Message([`${em.success} ${role} removed as a staff role for that panel.`]));
    } else if (sub === 'addcategory') {
      const panelId = args[1];
      const category = message.mentions.channels.find(channel => channel.type === ChannelType.GuildCategory);

      if (!panelId || !category) {
        await message.reply(v2Message([`${em.error} Usage: panel addcategory <panelid> #category`]));
        return;
      }

      const result = await addPanelCategory({ guild: message.guild, panelId, categoryId: category.id });
      if (!result.ok) {
        await message.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`]));
        return;
      }

      const limit = await limitFor(guildId, 'panelCategories');
      await message.reply(v2Message([`${em.success} ${category} added to that panel (${result.panel.categoryIds.length}/${limit}).`]));
    } else if (sub === 'removecategory') {
      const panelId = args[1];
      const category = message.mentions.channels.find(channel => channel.type === ChannelType.GuildCategory);

      if (!panelId || !category) {
        await message.reply(v2Message([`${em.error} Usage: panel removecategory <panelid> #category`]));
        return;
      }

      const result = await removePanelCategory({ guild: message.guild, panelId, categoryId: category.id });
      if (!result.ok) {
        await message.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`]));
        return;
      }

      await message.reply(v2Message([`${em.success} ${category} removed from that panel.`]));
    } else if (sub === 'addquestion') {
      const panelId = args[1];
      const question = args.slice(2).join(' ');

      if (!panelId || !question) {
        await message.reply(v2Message([`${em.error} Usage: panel addquestion <panelid> <question>`]));
        return;
      }

      const result = await addQuestion(guildId, panelId, question);
      if (!result.ok) {
        await message.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`]));
        return;
      }

      const limit = await limitFor(guildId, 'formQuestions');
      await message.reply(v2Message([`${em.success} Question added (${result.panel.questions.length}/${limit}).`]));
    } else if (sub === 'removequestion') {
      const panelId = args[1];
      const index = Number(args[2]) - 1;

      if (!panelId || Number.isNaN(index)) {
        await message.reply(v2Message([`${em.error} Usage: panel removequestion <panelid> <number>`]));
        return;
      }

      const result = await removeQuestion(guildId, panelId, index);
      if (!result.ok) {
        await message.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`]));
        return;
      }

      await message.reply(v2Message([`${em.success} Question removed.`]));
    } else if (sub === 'questions') {
      const panelId = args[1];
      const panels = await listPanels(guildId);
      const panel = panels.find(item => item.id === panelId);

      if (!panel) {
        await message.reply(v2Message([`${em.error} ${ERROR_MESSAGES['panel-missing']}`]));
        return;
      }

      if (!panel.questions.length) {
        await message.reply(v2Message([`${em.arrow} This panel has no intake questions.`]));
        return;
      }

      const lines = panel.questions.map((question, index) => `${index + 1}. ${question}`);
      await message.reply(v2Message([`**Questions for ${panel.name}**`, SEPARATOR, ...lines]));
    } else {
      await message.reply(v2Message([`${em.error} Usage: panel <create|delete|list|transcript|addstaffrole|removestaffrole|addcategory|removecategory|addquestion|removequestion|questions>`]));
    }
  }
};

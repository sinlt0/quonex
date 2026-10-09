const { ChannelType, PermissionFlagsBits } = require('discord.js');
const {
  createApplicationPanel,
  deleteApplicationPanel,
  listApplicationPanels,
  setReviewChannel,
  setAcceptRole,
  addReviewerRole,
  removeReviewerRole,
  addQuestion,
  removeQuestion,
  limitFor
} = require('../../../../lib/applications');
const { isDev } = require('../../../../lib/permissions');
const { em } = require('../../../../lib/emojis');
const { supportLine } = require('../../../../lib/support');
const { v2Message, SEPARATOR } = require('../../../../lib/components');
const { APPLICATION_ERROR_MESSAGES } = require('../../../../config/applications');

const MENTION_PATTERN = /<#\d+>|<@&\d+>/g;

module.exports = {
  name: 'application',
  category: 'Applications',
  description: 'Manage application panels',
  usage: 'application <create|delete|list|setreviewchannel|setacceptrole|addreviewerrole|removereviewerrole|addquestion|removequestion|questions>',
  async execute(message, args) {
    if (!message.guild) return;

    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !isDev(message.author.id)) {
      await message.reply(v2Message([`${em.error} You need the Manage Server permission to manage application panels.`, supportLine()]));
      return;
    }

    const sub = args[0];
    const guildId = message.guild.id;

    if (sub === 'create') {
      const reviewChannel = message.mentions.channels.first();
      const targetChannel = message.mentions.channels.filter(channel => channel.id !== (reviewChannel && reviewChannel.id)).first() || message.channel;

      if (!reviewChannel) {
        await message.reply(v2Message([`${em.error} Mention a review channel.`, 'Usage: application create #reviewchannel <name>']));
        return;
      }

      const name = args.slice(1).join(' ').replace(MENTION_PATTERN, '').trim() || 'Application';

      const result = await createApplicationPanel({
        guildId,
        name,
        channelId: targetChannel.id,
        reviewChannelId: reviewChannel.id,
        createdBy: message.author.id,
        targetChannel
      });

      if (!result.ok) {
        await message.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES[result.error]}`, supportLine()]));
        return;
      }

      await message.reply(
        v2Message([`${em.success} Application panel **${result.panel.name}** created in ${targetChannel} (ID: \`${result.panel.id}\`)`])
      );
    } else if (sub === 'delete') {
      const panelId = args[1];
      if (!panelId) {
        await message.reply(v2Message([`${em.error} Usage: application delete <panelid>`]));
        return;
      }

      const result = await deleteApplicationPanel(guildId, panelId, message.client);
      if (!result.ok) {
        await message.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES[result.error]}`]));
        return;
      }

      await message.reply(v2Message([`${em.success} Application panel **${result.panel.name}** deleted.`]));
    } else if (sub === 'list') {
      const panels = await listApplicationPanels(guildId);
      if (!panels.length) {
        await message.reply(v2Message([`${em.arrow} No application panels have been created yet.`]));
        return;
      }

      const lines = panels.map(panel => `\`${panel.id}\` — **${panel.name}**`);
      await message.reply(v2Message(['**Application Panels**', SEPARATOR, ...lines]));
    } else if (sub === 'setreviewchannel') {
      const panelId = args[1];
      const channel = message.mentions.channels.first();

      if (!panelId || !channel) {
        await message.reply(v2Message([`${em.error} Usage: application setreviewchannel <panelid> #channel`]));
        return;
      }

      const result = await setReviewChannel(guildId, panelId, channel.id);
      if (!result.ok) {
        await message.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES[result.error]}`]));
        return;
      }

      await message.reply(v2Message([`${em.success} Applications for that panel will now be reviewed in ${channel}.`]));
    } else if (sub === 'setacceptrole') {
      const panelId = args[1];
      const role = message.mentions.roles.first();

      if (!panelId) {
        await message.reply(v2Message([`${em.error} Usage: application setacceptrole <panelid> [@Role]`]));
        return;
      }

      const result = await setAcceptRole(guildId, panelId, role ? role.id : null);
      if (!result.ok) {
        await message.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES[result.error]}`]));
        return;
      }

      await message.reply(v2Message([role ? `${em.success} ${role} will be granted automatically on accept.` : `${em.success} Accept role cleared.`]));
    } else if (sub === 'addreviewerrole') {
      const panelId = args[1];
      const role = message.mentions.roles.first();

      if (!panelId || !role) {
        await message.reply(v2Message([`${em.error} Usage: application addreviewerrole <panelid> @Role`]));
        return;
      }

      const result = await addReviewerRole(guildId, panelId, role.id);
      if (!result.ok) {
        await message.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES[result.error]}`]));
        return;
      }

      await message.reply(v2Message([`${em.success} ${role} can now review applications for that panel.`]));
    } else if (sub === 'removereviewerrole') {
      const panelId = args[1];
      const role = message.mentions.roles.first();

      if (!panelId || !role) {
        await message.reply(v2Message([`${em.error} Usage: application removereviewerrole <panelid> @Role`]));
        return;
      }

      const result = await removeReviewerRole(guildId, panelId, role.id);
      if (!result.ok) {
        await message.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES[result.error]}`]));
        return;
      }

      await message.reply(v2Message([`${em.success} ${role} removed as a reviewer role for that panel.`]));
    } else if (sub === 'addquestion') {
      const panelId = args[1];
      const question = args.slice(2).join(' ');

      if (!panelId || !question) {
        await message.reply(v2Message([`${em.error} Usage: application addquestion <panelid> <question>`]));
        return;
      }

      const result = await addQuestion(guildId, panelId, question);
      if (!result.ok) {
        await message.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES[result.error]}`]));
        return;
      }

      const limit = await limitFor(guildId, 'applicationQuestions');
      await message.reply(v2Message([`${em.success} Question added (${result.panel.questions.length}/${limit}).`]));
    } else if (sub === 'removequestion') {
      const panelId = args[1];
      const index = Number(args[2]) - 1;

      if (!panelId || Number.isNaN(index)) {
        await message.reply(v2Message([`${em.error} Usage: application removequestion <panelid> <number>`]));
        return;
      }

      const result = await removeQuestion(guildId, panelId, index);
      if (!result.ok) {
        await message.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES[result.error]}`]));
        return;
      }

      await message.reply(v2Message([`${em.success} Question removed.`]));
    } else if (sub === 'questions') {
      const panelId = args[1];
      const panels = await listApplicationPanels(guildId);
      const panel = panels.find(item => item.id === panelId);

      if (!panel) {
        await message.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES['panel-missing']}`]));
        return;
      }

      if (!panel.questions.length) {
        await message.reply(v2Message([`${em.arrow} This panel has no questions.`]));
        return;
      }

      const lines = panel.questions.map((question, index) => `${index + 1}. ${question}`);
      await message.reply(v2Message([`**Questions for ${panel.name}**`, SEPARATOR, ...lines]));
    } else {
      await message.reply(
        v2Message([
          `${em.error} Usage: application <create|delete|list|setreviewchannel|setacceptrole|addreviewerrole|removereviewerrole|addquestion|removequestion|questions>`
        ])
      );
    }
  }
};

const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
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
const { em } = require('../../../../lib/emojis');
const { supportLine } = require('../../../../lib/support');
const { v2Message, SEPARATOR } = require('../../../../lib/components');
const { APPLICATION_ERROR_MESSAGES } = require('../../../../config/applications');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('application')
    .setDescription('Manage application panels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Create an application panel')
        .addStringOption(opt => opt.setName('name').setDescription('Panel name').setRequired(true))
        .addChannelOption(opt =>
          opt
            .setName('reviewchannel')
            .setDescription('Channel submissions are posted to for review')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt.setName('channel').setDescription('Channel to post the apply button in').addChannelTypes(ChannelType.GuildText)
        )
        .addRoleOption(opt => opt.setName('acceptrole').setDescription('Role granted automatically on accept'))
    )
    .addSubcommand(sub =>
      sub
        .setName('delete')
        .setDescription('Delete an application panel')
        .addStringOption(opt => opt.setName('panelid').setDescription('Panel ID').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('list').setDescription('List application panels'))
    .addSubcommand(sub =>
      sub
        .setName('setreviewchannel')
        .setDescription('Change the review channel for a panel')
        .addStringOption(opt => opt.setName('panelid').setDescription('Panel ID').setRequired(true))
        .addChannelOption(opt =>
          opt.setName('channel').setDescription('Review channel').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('setacceptrole')
        .setDescription('Set the role granted automatically when an application is accepted')
        .addStringOption(opt => opt.setName('panelid').setDescription('Panel ID').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role (omit to clear)'))
    )
    .addSubcommand(sub =>
      sub
        .setName('addreviewerrole')
        .setDescription('Add a role allowed to review applications for a panel')
        .addStringOption(opt => opt.setName('panelid').setDescription('Panel ID').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('removereviewerrole')
        .setDescription('Remove a reviewer role from a panel')
        .addStringOption(opt => opt.setName('panelid').setDescription('Panel ID').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('addquestion')
        .setDescription('Add a question shown before an application is submitted')
        .addStringOption(opt => opt.setName('panelid').setDescription('Panel ID').setRequired(true))
        .addStringOption(opt => opt.setName('question').setDescription('Question text').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('removequestion')
        .setDescription('Remove an application question')
        .addStringOption(opt => opt.setName('panelid').setDescription('Panel ID').setRequired(true))
        .addIntegerOption(opt => opt.setName('index').setDescription('Question number shown in /application questions').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('questions')
        .setDescription('List a panel questions')
        .addStringOption(opt => opt.setName('panelid').setDescription('Panel ID').setRequired(true))
    ),
  category: 'Applications',
  usage: '/application <create|delete|list|setreviewchannel|setacceptrole|addreviewerrole|removereviewerrole|addquestion|removequestion|questions>',
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'create') {
      const name = interaction.options.getString('name');
      const reviewChannel = interaction.options.getChannel('reviewchannel');
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const acceptRole = interaction.options.getRole('acceptrole');

      const result = await createApplicationPanel({
        guildId,
        name,
        channelId: channel.id,
        reviewChannelId: reviewChannel.id,
        acceptRoleId: acceptRole ? acceptRole.id : null,
        createdBy: interaction.user.id,
        targetChannel: channel
      });

      if (!result.ok) {
        await interaction.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES[result.error]}`, supportLine()], { ephemeral: true }));
        return;
      }

      await interaction.reply(
        v2Message([`${em.success} Application panel **${result.panel.name}** created in ${channel} (ID: \`${result.panel.id}\`)`], {
          ephemeral: true
        })
      );
    } else if (sub === 'delete') {
      const panelId = interaction.options.getString('panelid');
      const result = await deleteApplicationPanel(guildId, panelId, interaction.client);

      if (!result.ok) {
        await interaction.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
        return;
      }

      await interaction.reply(v2Message([`${em.success} Application panel **${result.panel.name}** deleted.`], { ephemeral: true }));
    } else if (sub === 'list') {
      const panels = await listApplicationPanels(guildId);

      if (!panels.length) {
        await interaction.reply(v2Message([`${em.arrow} No application panels have been created yet.`], { ephemeral: true }));
        return;
      }

      const lines = panels.map(panel => `\`${panel.id}\` — **${panel.name}**`);
      await interaction.reply(v2Message(['**Application Panels**', SEPARATOR, ...lines], { ephemeral: true }));
    } else if (sub === 'setreviewchannel') {
      const panelId = interaction.options.getString('panelid');
      const channel = interaction.options.getChannel('channel');
      const result = await setReviewChannel(guildId, panelId, channel.id);

      if (!result.ok) {
        await interaction.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
        return;
      }

      await interaction.reply(v2Message([`${em.success} Applications for that panel will now be reviewed in ${channel}.`], { ephemeral: true }));
    } else if (sub === 'setacceptrole') {
      const panelId = interaction.options.getString('panelid');
      const role = interaction.options.getRole('role');
      const result = await setAcceptRole(guildId, panelId, role ? role.id : null);

      if (!result.ok) {
        await interaction.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
        return;
      }

      await interaction.reply(
        v2Message([role ? `${em.success} ${role} will be granted automatically on accept.` : `${em.success} Accept role cleared.`], {
          ephemeral: true
        })
      );
    } else if (sub === 'addreviewerrole') {
      const panelId = interaction.options.getString('panelid');
      const role = interaction.options.getRole('role');
      const result = await addReviewerRole(guildId, panelId, role.id);

      if (!result.ok) {
        await interaction.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
        return;
      }

      await interaction.reply(v2Message([`${em.success} ${role} can now review applications for that panel.`], { ephemeral: true }));
    } else if (sub === 'removereviewerrole') {
      const panelId = interaction.options.getString('panelid');
      const role = interaction.options.getRole('role');
      const result = await removeReviewerRole(guildId, panelId, role.id);

      if (!result.ok) {
        await interaction.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
        return;
      }

      await interaction.reply(v2Message([`${em.success} ${role} removed as a reviewer role for that panel.`], { ephemeral: true }));
    } else if (sub === 'addquestion') {
      const panelId = interaction.options.getString('panelid');
      const question = interaction.options.getString('question');
      const result = await addQuestion(guildId, panelId, question);

      if (!result.ok) {
        await interaction.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
        return;
      }

      await interaction.reply(
        v2Message(
          [`${em.success} Question added (${result.panel.questions.length}/${await limitFor(guildId, 'applicationQuestions')}).`],
          { ephemeral: true }
        )
      );
    } else if (sub === 'removequestion') {
      const panelId = interaction.options.getString('panelid');
      const index = interaction.options.getInteger('index') - 1;
      const result = await removeQuestion(guildId, panelId, index);

      if (!result.ok) {
        await interaction.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
        return;
      }

      await interaction.reply(v2Message([`${em.success} Question removed.`], { ephemeral: true }));
    } else if (sub === 'questions') {
      const panelId = interaction.options.getString('panelid');
      const panels = await listApplicationPanels(guildId);
      const panel = panels.find(item => item.id === panelId);

      if (!panel) {
        await interaction.reply(v2Message([`${em.error} ${APPLICATION_ERROR_MESSAGES['panel-missing']}`], { ephemeral: true }));
        return;
      }

      if (!panel.questions.length) {
        await interaction.reply(v2Message([`${em.arrow} This panel has no questions.`], { ephemeral: true }));
        return;
      }

      const lines = panel.questions.map((question, index) => `${index + 1}. ${question}`);
      await interaction.reply(v2Message([`**Questions for ${panel.name}**`, SEPARATOR, ...lines], { ephemeral: true }));
    }
  }
};

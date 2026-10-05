const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
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
const { em } = require('../../../../lib/emojis');
const { supportLine } = require('../../../../lib/support');
const { v2Message, SEPARATOR } = require('../../../../lib/components');
const { ERROR_MESSAGES } = require('../../../../config/tickets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Manage ticket panels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Create a ticket panel')
        .addChannelOption(opt =>
          opt
            .setName('category')
            .setDescription('Category tickets are created under')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
        .addRoleOption(opt => opt.setName('staffrole').setDescription('Primary staff role').setRequired(true))
        .addStringOption(opt => opt.setName('name').setDescription('Panel name').setRequired(true))
        .addChannelOption(opt =>
          opt.setName('channel').setDescription('Channel to post the panel in').addChannelTypes(ChannelType.GuildText)
        )
        .addChannelOption(opt =>
          opt
            .setName('transcriptchannel')
            .setDescription('Channel transcripts are sent to')
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('delete')
        .setDescription('Delete a ticket panel')
        .addStringOption(opt => opt.setName('panelid').setDescription('Panel ID').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('list').setDescription('List ticket panels'))
    .addSubcommand(sub =>
      sub
        .setName('transcript')
        .setDescription('Set the transcript channel for a panel')
        .addStringOption(opt => opt.setName('panelid').setDescription('Panel ID').setRequired(true))
        .addChannelOption(opt =>
          opt.setName('channel').setDescription('Transcript channel').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('addstaffrole')
        .setDescription('Add a staff role to a panel')
        .addStringOption(opt => opt.setName('panelid').setDescription('Panel ID').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('removestaffrole')
        .setDescription('Remove a staff role from a panel')
        .addStringOption(opt => opt.setName('panelid').setDescription('Panel ID').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('addcategory')
        .setDescription('Add another ticket category to a panel')
        .addStringOption(opt => opt.setName('panelid').setDescription('Panel ID').setRequired(true))
        .addChannelOption(opt =>
          opt.setName('category').setDescription('Category').addChannelTypes(ChannelType.GuildCategory).setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('removecategory')
        .setDescription('Remove a ticket category from a panel')
        .addStringOption(opt => opt.setName('panelid').setDescription('Panel ID').setRequired(true))
        .addChannelOption(opt =>
          opt.setName('category').setDescription('Category').addChannelTypes(ChannelType.GuildCategory).setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('addquestion')
        .setDescription('Add an intake question shown before a ticket opens')
        .addStringOption(opt => opt.setName('panelid').setDescription('Panel ID').setRequired(true))
        .addStringOption(opt => opt.setName('question').setDescription('Question text').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('removequestion')
        .setDescription('Remove an intake question')
        .addStringOption(opt => opt.setName('panelid').setDescription('Panel ID').setRequired(true))
        .addIntegerOption(opt => opt.setName('index').setDescription('Question number shown in /panel questions').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('questions')
        .setDescription('List a panel intake questions')
        .addStringOption(opt => opt.setName('panelid').setDescription('Panel ID').setRequired(true))
    ),
  category: 'Tickets',
  usage: '/panel <create|delete|list|transcript|addstaffrole|removestaffrole|addcategory|removecategory|addquestion|removequestion|questions>',
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'create') {
      const category = interaction.options.getChannel('category');
      const staffRole = interaction.options.getRole('staffrole');
      const name = interaction.options.getString('name');
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const transcriptChannel = interaction.options.getChannel('transcriptchannel');

      const result = await createPanel({
        guildId,
        name,
        categoryId: category.id,
        channelId: channel.id,
        staffRoleId: staffRole.id,
        createdBy: interaction.user.id,
        targetChannel: channel,
        transcriptChannelId: transcriptChannel ? transcriptChannel.id : null
      });

      if (!result.ok) {
        await interaction.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`, supportLine()], { ephemeral: true }));
        return;
      }

      await interaction.reply(
        v2Message([`${em.success} Panel **${result.panel.name}** created in ${channel} (ID: \`${result.panel.id}\`)`], {
          ephemeral: true
        })
      );
    } else if (sub === 'delete') {
      const panelId = interaction.options.getString('panelid');
      const result = await deletePanel(guildId, panelId, interaction.client);

      if (!result.ok) {
        await interaction.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
        return;
      }

      await interaction.reply(v2Message([`${em.success} Panel **${result.panel.name}** deleted.`], { ephemeral: true }));
    } else if (sub === 'list') {
      const panels = await listPanels(guildId);

      if (!panels.length) {
        await interaction.reply(v2Message([`${em.arrow} No panels have been created yet.`], { ephemeral: true }));
        return;
      }

      const lines = panels.map(
        panel =>
          `\`${panel.id}\` — **${panel.name}** (${panel.categoryIds.length} categor${panel.categoryIds.length === 1 ? 'y' : 'ies'})`
      );
      await interaction.reply(v2Message(['**Ticket Panels**', SEPARATOR, ...lines], { ephemeral: true }));
    } else if (sub === 'transcript') {
      const panelId = interaction.options.getString('panelid');
      const channel = interaction.options.getChannel('channel');
      const result = await setTranscriptChannel(guildId, panelId, channel.id);

      if (!result.ok) {
        await interaction.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
        return;
      }

      await interaction.reply(v2Message([`${em.success} Transcripts for that panel will be sent to ${channel}.`], { ephemeral: true }));
    } else if (sub === 'addstaffrole') {
      const panelId = interaction.options.getString('panelid');
      const role = interaction.options.getRole('role');
      const result = await addStaffRole({ guild: interaction.guild, panelId, roleId: role.id });

      if (!result.ok) {
        await interaction.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
        return;
      }

      await interaction.reply(v2Message([`${em.success} ${role} added as a staff role for that panel.`], { ephemeral: true }));
    } else if (sub === 'removestaffrole') {
      const panelId = interaction.options.getString('panelid');
      const role = interaction.options.getRole('role');
      const result = await removeStaffRole({ guild: interaction.guild, panelId, roleId: role.id });

      if (!result.ok) {
        await interaction.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
        return;
      }

      await interaction.reply(v2Message([`${em.success} ${role} removed as a staff role for that panel.`], { ephemeral: true }));
    } else if (sub === 'addcategory') {
      const panelId = interaction.options.getString('panelid');
      const category = interaction.options.getChannel('category');
      const result = await addPanelCategory({ guild: interaction.guild, panelId, categoryId: category.id });

      if (!result.ok) {
        await interaction.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
        return;
      }

      const limit = await limitFor(guildId, 'panelCategories');
      await interaction.reply(
        v2Message([`${em.success} ${category} added to that panel (${result.panel.categoryIds.length}/${limit}).`], {
          ephemeral: true
        })
      );
    } else if (sub === 'removecategory') {
      const panelId = interaction.options.getString('panelid');
      const category = interaction.options.getChannel('category');
      const result = await removePanelCategory({ guild: interaction.guild, panelId, categoryId: category.id });

      if (!result.ok) {
        await interaction.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
        return;
      }

      await interaction.reply(v2Message([`${em.success} ${category} removed from that panel.`], { ephemeral: true }));
    } else if (sub === 'addquestion') {
      const panelId = interaction.options.getString('panelid');
      const question = interaction.options.getString('question');
      const result = await addQuestion(guildId, panelId, question);

      if (!result.ok) {
        await interaction.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
        return;
      }

      await interaction.reply(
        v2Message([`${em.success} Question added (${result.panel.questions.length}/${await limitFor(guildId, 'formQuestions')}).`], {
          ephemeral: true
        })
      );
    } else if (sub === 'removequestion') {
      const panelId = interaction.options.getString('panelid');
      const index = interaction.options.getInteger('index') - 1;
      const result = await removeQuestion(guildId, panelId, index);

      if (!result.ok) {
        await interaction.reply(v2Message([`${em.error} ${ERROR_MESSAGES[result.error]}`], { ephemeral: true }));
        return;
      }

      await interaction.reply(v2Message([`${em.success} Question removed.`], { ephemeral: true }));
    } else if (sub === 'questions') {
      const panelId = interaction.options.getString('panelid');
      const panels = await listPanels(guildId);
      const panel = panels.find(item => item.id === panelId);

      if (!panel) {
        await interaction.reply(v2Message([`${em.error} ${ERROR_MESSAGES['panel-missing']}`], { ephemeral: true }));
        return;
      }

      if (!panel.questions.length) {
        await interaction.reply(v2Message([`${em.arrow} This panel has no intake questions.`], { ephemeral: true }));
        return;
      }

      const lines = panel.questions.map((question, index) => `${index + 1}. ${question}`);
      await interaction.reply(v2Message([`**Questions for ${panel.name}**`, SEPARATOR, ...lines], { ephemeral: true }));
    }
  }
};

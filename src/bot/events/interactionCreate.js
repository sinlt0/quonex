const {
  handleOpenButton,
  handleTicketModalSubmit,
  handleModalContinueButton,
  handleClaimButton,
  handleCloseButton
} = require('../../lib/tickets');
const {
  handleOpenButton: handleApplicationOpenButton,
  handleApplicationModalSubmit,
  handleModalContinueButton: handleApplicationModalContinueButton,
  handleAcceptButton,
  handleDenyButton
} = require('../../lib/applications');
const { runSlashCommand, runInteractionHandler } = require('../../lib/commandRunner');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;
      await runSlashCommand(command, interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('ticket_modal_')) {
        await runInteractionHandler(handleTicketModalSubmit, interaction, 'ticket modal submit');
      } else if (interaction.customId.startsWith('application_modal_')) {
        await runInteractionHandler(handleApplicationModalSubmit, interaction, 'application modal submit');
      }
      return;
    }

    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith('ticket_modal_continue_')) {
      await runInteractionHandler(handleModalContinueButton, interaction, 'ticket modal continue');
    } else if (interaction.customId.startsWith('ticket_open_')) {
      await runInteractionHandler(handleOpenButton, interaction, 'ticket open button');
    } else if (interaction.customId.startsWith('ticket_claim_')) {
      await runInteractionHandler(handleClaimButton, interaction, 'ticket claim button');
    } else if (interaction.customId.startsWith('ticket_close_')) {
      await runInteractionHandler(handleCloseButton, interaction, 'ticket close button');
    } else if (interaction.customId.startsWith('application_modal_continue_')) {
      await runInteractionHandler(handleApplicationModalContinueButton, interaction, 'application modal continue');
    } else if (interaction.customId.startsWith('application_open_')) {
      await runInteractionHandler(handleApplicationOpenButton, interaction, 'application open button');
    } else if (interaction.customId.startsWith('application_accept_')) {
      await runInteractionHandler(handleAcceptButton, interaction, 'application accept button');
    } else if (interaction.customId.startsWith('application_deny_')) {
      await runInteractionHandler(handleDenyButton, interaction, 'application deny button');
    }
  }
};

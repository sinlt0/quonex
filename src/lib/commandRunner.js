const { em } = require('./emojis');
const { supportLine } = require('./support');
const { v2Message } = require('./components');

async function runSlashCommand(command, interaction) {
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error in /${interaction.commandName}:`, error);
    const payload = v2Message([`${em.error} Something went wrong running that command.`, supportLine()], { ephemeral: true });
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch (replyError) {
      console.error('Failed to send error reply:', replyError);
    }
  }
}

async function runTextCommand(command, message, args) {
  try {
    await command.execute(message, args);
  } catch (error) {
    console.error(`Error in command ${command.name}:`, error);
    try {
      await message.reply(v2Message([`${em.error} Something went wrong running that command.`, supportLine()]));
    } catch (replyError) {
      console.error('Failed to send error reply:', replyError);
    }
  }
}

async function runInteractionHandler(handler, interaction, label) {
  try {
    await handler(interaction);
  } catch (error) {
    console.error(`Error in ${label}:`, error);
    const payload = v2Message([`${em.error} Something went wrong.`, supportLine()], { ephemeral: true });
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch (replyError) {
      console.error('Failed to send error reply:', replyError);
    }
  }
}

module.exports = { runSlashCommand, runTextCommand, runInteractionHandler };

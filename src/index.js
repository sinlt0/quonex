require('dotenv').config();
const client = require('./bot/client');
const { loadCommands } = require('./bot/handlers/commandHandler');
const { loadEvents } = require('./bot/handlers/eventHandler');
const { textCommands } = require('./lib/textCommands');

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
});

loadCommands(client);
loadEvents(client);
client.textCommands = textCommands;

client.login(process.env.DISCORD_TOKEN);

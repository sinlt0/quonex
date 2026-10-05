require('dotenv').config();
const path = require('path');
const { REST, Routes } = require('discord.js');
const { walk } = require('./src/bot/handlers/commandHandler');

async function deploy() {
  const commandsDir = path.join(__dirname, 'src', 'bot', 'commands', 'slash');
  const files = walk(commandsDir);
  const commands = files.map(file => require(file).data.toJSON());

  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });

  console.log(`Quonex | Deployed ${commands.length} commands`);
}

deploy();

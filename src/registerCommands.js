import { REST, Routes } from 'discord.js';
import { buildCommands } from './discordCommands.js';
import { CONFIG } from './config.js';

export async function registerGlobalCommands() {
  const rest = new REST({ version: '10' }).setToken(CONFIG.discordToken);
  const commands = buildCommands();

  await rest.put(
    Routes.applicationCommands(CONFIG.discordClientId),
    { body: commands }
  );

  return commands.length;
}

import { SlashCommandBuilder } from 'discord.js';

export function buildCommands() {
  const pse = new SlashCommandBuilder()
    .setName('pse')
    .setDescription('Show which Roblox group members are online and what they are playing.');

  const auth = new SlashCommandBuilder()
    .setName('auth')
    .setDescription('Owner only: grant Unlimited Access to a Discord user ID.')
    .addStringOption(opt =>
      opt.setName('userid')
        .setDescription('Discord user ID to authorize')
        .setRequired(true)
    );

  const unauth = new SlashCommandBuilder()
    .setName('unauth')
    .setDescription('Owner only: remove Unlimited Access from a Discord user ID.')
    .addStringOption(opt =>
      opt.setName('userid')
        .setDescription('Discord user ID to unauthorize')
        .setRequired(true)
    );

  const authinfo = new SlashCommandBuilder()
    .setName('authinfo')
    .setDescription('Owner only: list users in trial/unlimited state.');

  // dm_permission helps commands show in DMs; global propagation still applies.
  const cmds = [pse, auth, unauth, authinfo].map(c => {
    const json = c.toJSON();
    json.dm_permission = true;
    return json;
  });

  return cmds;
}

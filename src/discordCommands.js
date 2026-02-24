import { SlashCommandBuilder, InteractionContextType, ApplicationIntegrationType } from 'discord.js';

export function buildCommands() {
  const userOnly = (builder) =>
    builder
      .setContexts(InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
      .setIntegrationTypes(ApplicationIntegrationType.UserInstall);

  const pse = userOnly(
    new SlashCommandBuilder()
      .setName('pse')
      .setDescription('Show Roblox group members online/in-game, with game and join link when available.')
  );

  const auth = userOnly(
    new SlashCommandBuilder()
      .setName('auth')
      .setDescription('Owner only: grant Unlimited Access to a Discord user ID.')
      .addStringOption(opt =>
        opt.setName('userid').setDescription('Discord user ID').setRequired(true)
      )
  );

  const unauth = userOnly(
    new SlashCommandBuilder()
      .setName('unauth')
      .setDescription('Owner only: remove Unlimited Access from a Discord user ID.')
      .addStringOption(opt =>
        opt.setName('userid').setDescription('Discord user ID').setRequired(true)
      )
  );

  const blacklist = userOnly(
    new SlashCommandBuilder()
      .setName('blacklist')
      .setDescription('Owner only: blacklist a Discord user ID from using /pse.')
      .addStringOption(opt =>
        opt.setName('userid').setDescription('Discord user ID').setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('reason').setDescription('Reason (optional)').setRequired(false)
      )
  );

  const unblacklist = userOnly(
    new SlashCommandBuilder()
      .setName('unblacklist')
      .setDescription('Owner only: remove a user from the blacklist.')
      .addStringOption(opt =>
        opt.setName('userid').setDescription('Discord user ID').setRequired(true)
      )
  );

  const authinfo = userOnly(
    new SlashCommandBuilder()
      .setName('authinfo')
      .setDescription('Owner only: show Blacklisted / Unlimited / Trial users.')
  );

  return [pse, auth, unauth, blacklist, unblacklist, authinfo].map(c => c.toJSON());
}

import { SlashCommandBuilder, InteractionContextType, ApplicationIntegrationType } from 'discord.js';

export function buildCommands() {
  // For user-installed apps, commands should define:
  // - contexts: where the command can be used (DMs, Group DMs/private channels, etc.)
  // - integration types: whether the command is available for user installs and/or guild installs.
  //
  // Without these, Discord may accept the registration but not surface commands in private channels.

  const userOnly = (builder) =>
    builder
      .setContexts(InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
      .setIntegrationTypes(ApplicationIntegrationType.UserInstall);

  const pse = userOnly(
    new SlashCommandBuilder()
      .setName('pse')
      .setDescription('Show which Roblox group members are online and what they are playing.')
  );

  const auth = userOnly(
    new SlashCommandBuilder()
      .setName('auth')
      .setDescription('Owner only: grant Unlimited Access to a Discord user ID.')
      .addStringOption(opt =>
        opt.setName('userid')
          .setDescription('Discord user ID to authorize')
          .setRequired(true)
      )
  );

  const unauth = userOnly(
    new SlashCommandBuilder()
      .setName('unauth')
      .setDescription('Owner only: remove Unlimited Access from a Discord user ID.')
      .addStringOption(opt =>
        opt.setName('userid')
          .setDescription('Discord user ID to unauthorize')
          .setRequired(true)
      )
  );

  const authinfo = userOnly(
    new SlashCommandBuilder()
      .setName('authinfo')
      .setDescription('Owner only: list users in trial/unlimited state.')
  );

  return [pse, auth, unauth, authinfo].map(c => c.toJSON());
}

import 'dotenv/config';

function must(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const CONFIG = {
  discordToken: must('DISCORD_TOKEN'),
  discordClientId: must('DISCORD_CLIENT_ID'),
  ownerDiscordId: must('OWNER_DISCORD_ID'),

  robloxGroupId: Number(process.env.ROBLOX_GROUP_ID ?? '34441815'),
  installUrl: process.env.INSTALL_URL ?? `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}`,
};

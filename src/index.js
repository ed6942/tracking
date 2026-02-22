import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
} from 'discord.js';

import { CONFIG } from './config.js';
import { registerGlobalCommands } from './registerCommands.js';
import { decrementTrialUse, getOrCreateUser, getUser, listUsers, setUnlimited } from './authStore.js';
import {
  fetchGroupMemberUserIds,
  fetchPresence,
  fetchUserBasics,
  fetchGameInfoByUniverseIds,
  placeIdToUniverseId,
} from './roblox.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds], // interactions
});

function addApplicationRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Add Application')
      .setStyle(ButtonStyle.Link)
      .setURL(CONFIG.installUrl),
  );
}

function isOwner(interaction) {
  return interaction.user?.id === CONFIG.ownerDiscordId;
}

function parseId(str) {
  const s = String(str ?? '').trim();
  if (!/^[0-9]{5,30}$/.test(s)) return null;
  return s;
}

async function buildPseEmbedLines() {
  const groupId = CONFIG.robloxGroupId;
  const userIds = await fetchGroupMemberUserIds(groupId);

  const presences = await fetchPresence(userIds);

  // Filter to not-offline
  const online = presences.filter(p => (p?.userPresenceType ?? 0) !== 0);

  // Fetch user basics (display + username)
  const basicsCache = new Map();
  for (const p of online) {
    const id = p.userId;
    if (!basicsCache.has(id)) {
      try {
        const b = await fetchUserBasics(id);
        basicsCache.set(id, b);
      } catch {
        basicsCache.set(id, { name: String(id), displayName: String(id) });
      }
    }
  }

  // For in-game users, map placeId -> universeId -> game name
  const placeIds = [...new Set(online.map(p => Number(p.placeId ?? 0)).filter(n => Number.isFinite(n) && n > 0))];

  const placeToUniverse = new Map();
  for (const placeId of placeIds) {
    try {
      const u = await placeIdToUniverseId(placeId);
      if (u) placeToUniverse.set(placeId, u);
    } catch {
      // ignore
    }
  }

  const universeIds = [...new Set([...placeToUniverse.values()])];
  const games = await fetchGameInfoByUniverseIds(universeIds);
  const universeToName = new Map(games.map(g => [Number(g.id), g.name]));

  // Compose display lines
  const lines = [];
  for (const p of online) {
    const b = basicsCache.get(p.userId) ?? { name: String(p.userId), displayName: String(p.userId) };
    const display = b.displayName ?? b.name ?? String(p.userId);
    const username = b.name ?? String(p.userId);

    const presenceType = Number(p.userPresenceType ?? 0);
    let gameLabel = 'Online';
    let joinMarkdown = '—';

    if (presenceType === 2) {
      // In Game
      const placeId = Number(p.placeId ?? 0);
      const universeId = placeToUniverse.get(placeId);
      const gameName = universeId ? (universeToName.get(Number(universeId)) ?? null) : null;

      gameLabel = gameName ?? (p.lastLocation && p.lastLocation !== 'Website' ? p.lastLocation : 'In Game');

      if (placeId > 0) {
        const url = `https://roblox.com/games/start?placeId=${placeId}`;
        joinMarkdown = `[Click here to join!](${url})`;
      } else {
        joinMarkdown = '—';
      }
    } else if (presenceType === 3) {
      gameLabel = 'In Studio';
      joinMarkdown = '—';
    } else if (presenceType === 1) {
      gameLabel = 'Online';
      joinMarkdown = '—';
    }

    lines.push(`**${escapeMarkdown(display)} (${escapeMarkdown(username)})** | *${escapeMarkdown(gameLabel)}* | ${joinMarkdown}`);
  }

  // Sort: In Game first, then Online, then Studio (optional)
  lines.sort((a, b) => {
    const ra = a.includes('*In Game*') ? 0 : a.includes('*Online*') ? 1 : 2;
    const rb = b.includes('*In Game*') ? 0 : b.includes('*Online*') ? 1 : 2;
    return ra - rb;
  });

  return lines;
}

function escapeMarkdown(s) {
  return String(s ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll('*', '\\*')
    .replaceAll('_', '\\_')
    .replaceAll('`', '\\`')
    .replaceAll('~', '\\~')
    .replaceAll('|', '\\|');
}

function chunkTextLines(lines, maxLen = 3900) {
  // Discord embed description max 4096. Keep safe.
  const chunks = [];
  let cur = '';
  for (const line of lines) {
    const next = cur ? (cur + '\n' + line) : line;
    if (next.length > maxLen) {
      if (cur) chunks.push(cur);
      cur = line;
    } else {
      cur = next;
    }
  }
  if (cur) chunks.push(cur);
  return chunks.length ? chunks : ['No players are currently online.'];
}

client.once('ready', async () => {
  try {
    const n = await registerGlobalCommands();
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`✅ Registered ${n} global commands`);
  } catch (e) {
    console.error('Failed to register commands:', e);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'auth') {
      if (!isOwner(interaction)) {
        return interaction.reply({ content: '❌ Not allowed.', ephemeral: true });
      }
      const raw = interaction.options.getString('userid', true);
      const id = parseId(raw);
      if (!id) return interaction.reply({ content: '❌ Invalid user ID.', ephemeral: true });

      const u = setUnlimited(id, true);
      return interaction.reply({
        content: `✅ Authorized as **Unlimited Access**\nUser ID: \`${id}\``,
        ephemeral: true,
      });
    }

    if (interaction.commandName === 'unauth') {
      if (!isOwner(interaction)) {
        return interaction.reply({ content: '❌ Not allowed.', ephemeral: true });
      }
      const raw = interaction.options.getString('userid', true);
      const id = parseId(raw);
      if (!id) return interaction.reply({ content: '❌ Invalid user ID.', ephemeral: true });

      const u = setUnlimited(id, false);
      return interaction.reply({
        content: `🚫 Unlimited removed\nUser ID: \`${id}\`\nTrial uses left: **${u.trialUsesLeft ?? 0}**`,
        ephemeral: true,
      });
    }

    if (interaction.commandName === 'authinfo') {
      if (!isOwner(interaction)) {
        return interaction.reply({ content: '❌ Not allowed.', ephemeral: true });
      }
      const users = listUsers();
      const unlimited = users.filter(u => !!u.unlimited);
      const trial = users.filter(u => !u.unlimited);

      const lines = [];
      lines.push(`**Unlimited (${unlimited.length})**`);
      if (unlimited.length) {
        for (const u of unlimited.slice(0, 50)) lines.push(`• \`${u.id}\` — Unlimited`);
      } else {
        lines.push('• (none)');
      }
      lines.push('');
      lines.push(`**Trial (${trial.length})**`);
      if (trial.length) {
        for (const u of trial.slice(0, 50)) lines.push(`• \`${u.id}\` — ${u.trialUsesLeft ?? 0} left`);
      } else {
        lines.push('• (none)');
      }

      return interaction.reply({
        content: lines.join('\n'),
        ephemeral: true,
      });
    }

    if (interaction.commandName === 'pse') {
      // Trial / unlimited check
      const record = getOrCreateUser(interaction.user.id);

      if (!record.unlimited && Number(record.trialUsesLeft ?? 0) <= 0) {
        return interaction.reply({
          content: `❌ **You’ve used all your free tries.**\nDM **M5** to purchase **Unlimited**.`,
          ephemeral: true,
          components: [addApplicationRow()],
        });
      }

      // Acknowledge quickly (Roblox calls can take a moment)
      await interaction.deferReply();

      const lines = await buildPseEmbedLines();
      const chunks = chunkTextLines(lines);

      const embeds = chunks.map((desc, idx) => new EmbedBuilder()
        .setTitle(lines.length ? '🟢 PSE – Players Online' : '🔴 PSE – Players Online')
        .setDescription(desc)
        .setTimestamp(new Date())
      );

      // Update trial usage AFTER successful fetch
      let footerText = '';
      if (record.unlimited) {
        footerText = 'Unlimited Access • Thanks for purchasing';
      } else {
        const u2 = decrementTrialUse(interaction.user.id);
        footerText = `Trial uses left: ${u2.trialUsesLeft ?? 0} • DM M5 to get Unlimited`;
      }
      embeds.forEach(e => e.setFooter({ text: footerText }));

      // Discord allows only 10 embeds per message
      const limitedEmbeds = embeds.slice(0, 10);

      return interaction.editReply({
        embeds: limitedEmbeds,
        components: [addApplicationRow()],
      });
    }
  } catch (e) {
    console.error('Interaction error:', e);
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: '❌ Something went wrong. Try again later.', embeds: [], components: [addApplicationRow()] }).catch(() => {});
    }
    return interaction.reply({ content: '❌ Something went wrong. Try again later.', ephemeral: true, components: [addApplicationRow()] }).catch(() => {});
  }
});

client.login(CONFIG.discordToken);

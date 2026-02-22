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
import {
  decrementTrialUse,
  getOrCreateUser,
  listUsers,
  setUnlimited,
} from './authStore.js';

import {
  fetchGroupMemberUserIds,
  fetchPresence,
  fetchUserBasics,
  fetchGameInfoByUniverseIds,
  placeIdToUniverseId,
} from './roblox.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

function addApplicationRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Add Application')
      .setStyle(ButtonStyle.Link)
      .setURL(CONFIG.installUrl)
  );
}

function isOwner(interaction) {
  return interaction.user?.id === CONFIG.ownerDiscordId;
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

function presenceLabel(t) {
  switch (Number(t)) {
    case 2: return 'In Game';
    case 3: return 'In Studio';
    case 1: return 'Online';
    default: return 'Offline';
  }
}

function chunkText(str, maxLen = 3900) {
  // Embed description max is 4096; keep safe.
  if (str.length <= maxLen) return [str];
  const parts = [];
  let cur = '';
  for (const line of str.split('\n')) {
    const next = cur ? `${cur}\n${line}` : line;
    if (next.length > maxLen) {
      parts.push(cur);
      cur = line;
    } else {
      cur = next;
    }
  }
  if (cur) parts.push(cur);
  return parts;
}

client.once('ready', async () => {
  const count = await registerGlobalCommands();
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`✅ Registered ${count} global commands`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    /* ================= OWNER COMMANDS ================= */

    if (interaction.commandName === 'auth') {
      if (!isOwner(interaction)) {
        return interaction.reply({ content: '❌ Not allowed.', ephemeral: true });
      }
      const id = interaction.options.getString('userid', true).trim();
      setUnlimited(id, true);
      return interaction.reply({ content: `✅ <@${id}> is now **Unlimited**`, ephemeral: true });
    }

    if (interaction.commandName === 'unauth') {
      if (!isOwner(interaction)) {
        return interaction.reply({ content: '❌ Not allowed.', ephemeral: true });
      }
      const id = interaction.options.getString('userid', true).trim();
      const user = setUnlimited(id, false);
      return interaction.reply({
        content: `🚫 Unlimited removed from <@${id}> — Trial left: **${user.trialUsesLeft ?? 0}**`,
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
        for (const u of unlimited) lines.push(`• <@${u.id}> (\`${u.id}\`) — Unlimited`);
      } else {
        lines.push('• none');
      }

      lines.push('');
      lines.push(`**Trial (${trial.length})**`);
      if (trial.length) {
        for (const u of trial) lines.push(`• <@${u.id}> (\`${u.id}\`) — ${u.trialUsesLeft ?? 0} left`);
      } else {
        lines.push('• none');
      }

      return interaction.reply({ content: lines.join('\n'), ephemeral: true });
    }

    /* ================= PSE ================= */

    if (interaction.commandName === 'pse') {
      const record = getOrCreateUser(interaction.user.id);

      if (!record.unlimited && Number(record.trialUsesLeft ?? 0) <= 0) {
        return interaction.reply({
          content: `❌ **You’ve used all free tries.**\nDM **M5** to purchase **Unlimited**.`,
          ephemeral: true,
          components: [addApplicationRow()],
        });
      }

      await interaction.deferReply();

      // Fetch group members + presence
      const memberUserIds = await fetchGroupMemberUserIds(CONFIG.robloxGroupId);
      const presences = await fetchPresence(memberUserIds);

      // Keep only not-offline
      const online = presences.filter(p => Number(p?.userPresenceType ?? 0) !== 0);

      // Fetch displayName + username for online users
      const basicsById = new Map();
      for (const p of online) {
        if (!basicsById.has(p.userId)) {
          try {
            basicsById.set(p.userId, await fetchUserBasics(p.userId));
          } catch {
            basicsById.set(p.userId, { name: String(p.userId), displayName: String(p.userId) });
          }
        }
      }

      // Gather placeIds for in-game users
      const placeIds = [...new Set(
        online
          .filter(p => Number(p.userPresenceType) === 2)
          .map(p => Number(p.placeId ?? 0))
          .filter(n => Number.isFinite(n) && n > 0)
      )];

      // placeId -> universeId
      const placeToUniverse = new Map();
      for (const placeId of placeIds) {
        try {
          const universeId = await placeIdToUniverseId(placeId);
          if (universeId) placeToUniverse.set(placeId, Number(universeId));
        } catch {
          // ignore
        }
      }

      // universeId -> game name
      const universeIds = [...new Set([...placeToUniverse.values()])];
      const games = await fetchGameInfoByUniverseIds(universeIds);
      const universeToName = new Map(games.map(g => [Number(g.id), g.name]));

      // Build output lines
      const lines = [];

      for (const p of online) {
        const b = basicsById.get(p.userId);
        const display = escapeMarkdown(b?.displayName ?? b?.name ?? String(p.userId));
        const username = escapeMarkdown(b?.name ?? String(p.userId));

        const t = Number(p.userPresenceType ?? 0);
        const placeId = Number(p.placeId ?? 0);
        const lastLocation = p.lastLocation ? String(p.lastLocation) : '';

        // GAME NAME LOGIC (fixed)
        let gameText = presenceLabel(t);

        if (t === 2) {
          // In Game: prefer API name, else lastLocation, else "In Game"
          let apiName = null;
          if (placeId > 0) {
            const universeId = placeToUniverse.get(placeId);
            if (universeId) apiName = universeToName.get(universeId) ?? null;
          }
          const loc = (lastLocation && lastLocation !== 'Website') ? lastLocation : '';
          gameText = apiName ?? loc ?? 'In Game';
        } else if (t === 1) {
          gameText = 'Online';
        } else if (t === 3) {
          gameText = 'In Studio';
        }

        // JOIN LINK (only if we at least have placeId)
        let join = '—';
        if (t === 2 && placeId > 0) {
          join = `[Click here to join!](https://roblox.com/games/start?placeId=${placeId})`;
        }

        // OPTIONAL OWNER DEBUG: uncomment next 2 lines if you want proof of Roblox data
        // const debug = isOwner(interaction) ? ` (t=${t}, placeId=${placeId || 0}, last="${escapeMarkdown(lastLocation)}")` : '';
        // gameText = `${gameText}${debug}`;

        lines.push(`**${display} (${username})** | ${escapeMarkdown(gameText)} | ${join}`);
      }

      // Sort: In Game first, then Online, then Studio
      lines.sort((a, b) => {
        const ra = a.includes('| In Game') ? 0 : a.includes('| Online') ? 1 : 2;
        const rb = b.includes('| In Game') ? 0 : b.includes('| Online') ? 1 : 2;
        return ra - rb;
      });

      const title = online.length ? '🟢 PSE – Players Online' : '🔴 PSE – Players Online';
      const body = online.length ? lines.join('\n') : 'No players are currently online.';
      const parts = chunkText(body);

      const footerText = record.unlimited
        ? 'Unlimited Access • Thanks for purchasing'
        : `Trial uses left: ${decrementTrialUse(interaction.user.id).trialUsesLeft ?? 0} • DM M5 to get Unlimited`;

      const embeds = parts.slice(0, 10).map(desc =>
        new EmbedBuilder()
          .setTitle(title)
          .setDescription(desc)
          .setFooter({ text: footerText })
          .setTimestamp(new Date())
      );

      return interaction.editReply({
        embeds,
        components: [addApplicationRow()],
      });
    }
  } catch (err) {
    console.error(err);
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: '❌ Something went wrong.', embeds: [], components: [addApplicationRow()] }).catch(() => {});
    }
    return interaction.reply({ content: '❌ Something went wrong.', ephemeral: true, components: [addApplicationRow()] }).catch(() => {});
  }
});

client.login(CONFIG.discordToken);

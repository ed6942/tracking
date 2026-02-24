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
  setBlacklisted,
} from './authStore.js';
import {
  fetchGroupMemberUserIds,
  fetchPresence,
  fetchUserBasics,
  fetchGameInfoByUniverseIds,
  placeIdToUniverseId,
} from './roblox.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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

function chunksByLength(lines, maxLen = 3900) {
  const chunks = [];
  let cur = '';
  for (const line of lines) {
    const next = cur ? `${cur}\n${line}` : line;
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

async function buildPseLines() {
  const userIds = await fetchGroupMemberUserIds(CONFIG.robloxGroupId);
  const presences = await fetchPresence(userIds);

  const online = presences.filter(p => Number(p?.userPresenceType ?? 0) !== 0);

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

  const placeIds = [...new Set(
    online
      .filter(p => Number(p.userPresenceType) === 2)
      .map(p => Number(p.placeId ?? 0))
      .filter(n => Number.isFinite(n) && n > 0)
  )];

  const placeToUniverse = new Map();
  for (const placeId of placeIds) {
    try {
      const universeId = await placeIdToUniverseId(placeId);
      if (universeId) placeToUniverse.set(placeId, Number(universeId));
    } catch {}
  }

  const universeIds = [...new Set([...placeToUniverse.values()])];
  const games = await fetchGameInfoByUniverseIds(universeIds);
  const universeToName = new Map(games.map(g => [Number(g.id), g.name]));

  const lines = [];

  for (const p of online) {
    const b = basicsById.get(p.userId) ?? { name: String(p.userId), displayName: String(p.userId) };
    const display = escapeMarkdown(b.displayName ?? b.name ?? String(p.userId));
    const username = escapeMarkdown(b.name ?? String(p.userId));

    const t = Number(p.userPresenceType ?? 0);
    const placeId = Number(p.placeId ?? 0);
    const lastLocation = (p.lastLocation && p.lastLocation !== 'Website') ? String(p.lastLocation) : '';

    if (t === 1 || t === 3) {
      lines.push(`**${display} (${username})** | 🔵 Online`);
      continue;
    }

    if (t === 2) {
      let gameName = null;
      if (placeId > 0) {
        const universeId = placeToUniverse.get(placeId);
        if (universeId) gameName = universeToName.get(Number(universeId)) ?? null;
      }
      gameName = gameName ?? (lastLocation.trim() ? lastLocation.trim() : null);

      if (!gameName) {
        lines.push(`**${display} (${username})** | 🟢 In Game`);
        continue;
      }

      if (placeId > 0) {
        const join = `[Click here to join!](https://roblox.com/games/start?placeId=${placeId})`;
        lines.push(`**${display} (${username})** | 🟢 ${escapeMarkdown(gameName)} | ${join}`);
      } else {
        lines.push(`**${display} (${username})** | 🟢 ${escapeMarkdown(gameName)}`);
      }
      continue;
    }

    lines.push(`**${display} (${username})** | 🔵 Online`);
  }

  lines.sort((a, b) => {
    const aG = a.includes('| 🟢') ? 0 : 1;
    const bG = b.includes('| 🟢') ? 0 : 1;
    return aG - bG;
  });

  return lines;
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
    const cmd = interaction.commandName;

    if (cmd === 'auth') {
      if (!isOwner(interaction)) return interaction.reply({ content: '❌ Not allowed.' });
      const id = interaction.options.getString('userid', true).trim();
      setUnlimited(id, true);
      return interaction.reply({ content: `✅ <@${id}> is now **Unlimited Access**.` });
    }

    if (cmd === 'unauth') {
      if (!isOwner(interaction)) return interaction.reply({ content: '❌ Not allowed.' });
      const id = interaction.options.getString('userid', true).trim();
      const u = setUnlimited(id, false);
      return interaction.reply({ content: `🚫 Unlimited removed from <@${id}>. Trial left: **${u.trialUsesLeft ?? 0}**` });
    }

    if (cmd === 'blacklist') {
      if (!isOwner(interaction)) return interaction.reply({ content: '❌ Not allowed.' });
      const id = interaction.options.getString('userid', true).trim();
      const reason = interaction.options.getString('reason', false);
      setBlacklisted(id, true, reason ?? null);
      return interaction.reply({ content: `🚫 <@${id}> has been **blacklisted**${reason ? ` — Reason: ${reason}` : ''}` });
    }

    if (cmd === 'unblacklist') {
      if (!isOwner(interaction)) return interaction.reply({ content: '❌ Not allowed.' });
      const id = interaction.options.getString('userid', true).trim();
      setBlacklisted(id, false, null);
      return interaction.reply({ content: `✅ <@${id}> has been **unblacklisted**.` });
    }

    if (cmd === 'authinfo') {
      if (!isOwner(interaction)) return interaction.reply({ content: '❌ Not allowed.' });

      const users = listUsers();
      const blacklisted = users.filter(u => !!u.blacklisted);
      const unlimited = users.filter(u => !u.blacklisted && !!u.unlimited);
      const trial = users.filter(u => !u.blacklisted && !u.unlimited);

      const lines = [];
      lines.push(`**Blacklisted (${blacklisted.length})**`);
      if (blacklisted.length) {
        for (const u of blacklisted) {
          lines.push(`• <@${u.id}> (\`${u.id}\`)${u.blacklistReason ? ` — ${escapeMarkdown(u.blacklistReason)}` : ''}`);
        }
      } else lines.push('• none');

      lines.push('');
      lines.push(`**Unlimited (${unlimited.length})**`);
      if (unlimited.length) {
        for (const u of unlimited) lines.push(`• <@${u.id}> (\`${u.id}\`) — Unlimited`);
      } else lines.push('• none');

      lines.push('');
      lines.push(`**Trial (${trial.length})**`);
      if (trial.length) {
        for (const u of trial) lines.push(`• <@${u.id}> (\`${u.id}\`) — ${u.trialUsesLeft ?? 0} left`);
      } else lines.push('• none');

      // embed(s) if long
      const descs = [];
      let cur = '';
      for (const line of lines) {
        const next = cur ? `${cur}\n${line}` : line;
        if (next.length > 3900) {
          descs.push(cur);
          cur = line;
        } else {
          cur = next;
        }
      }
      if (cur) descs.push(cur);

      const embeds = descs.slice(0, 10).map(d =>
        new EmbedBuilder()
          .setTitle('Auth Info')
          .setDescription(d)
          .setTimestamp(new Date())
      );

      return interaction.reply({ embeds });
    }

    if (cmd === 'pse') {
      const record = getOrCreateUser(interaction.user.id);

      if (record.blacklisted) {
        const reason = record.blacklistReason ? `\nReason: ${record.blacklistReason}` : '';
        return interaction.reply({
          content: `❌ You are blacklisted from using this bot.${reason}`,
          components: [addApplicationRow()],
        });
      }

      if (!record.unlimited && Number(record.trialUsesLeft ?? 0) <= 0) {
        return interaction.reply({
          content: `❌ You’ve used all your free tries. DM **M5** to purchase **Unlimited**.`,
          components: [addApplicationRow()],
        });
      }

      await interaction.deferReply();

      const lines = await buildPseLines();

      const footerText = record.unlimited
        ? 'Unlimited Access • Thanks for purchasing'
        : (() => {
            const u2 = decrementTrialUse(interaction.user.id);
            return `Trial uses left: ${u2.trialUsesLeft ?? 0} • DM M5 to get Unlimited`;
          })();

      // chunk into multiple embeds if needed
      const parts = [];
      let cur = '';
      for (const line of (lines.length ? lines : ['No players are currently online.'])) {
        const next = cur ? `${cur}\n${line}` : line;
        if (next.length > 3900) {
          parts.push(cur);
          cur = line;
        } else {
          cur = next;
        }
      }
      if (cur) parts.push(cur);

      const embeds = parts.slice(0, 10).map(desc =>
        new EmbedBuilder()
          .setTitle('🚨 PSE – Players Online')
          .setDescription(desc)
          .setFooter({ text: footerText })
          .setTimestamp(new Date())
      );

      return interaction.editReply({ embeds, components: [addApplicationRow()] });
    }
  } catch (e) {
    console.error('Interaction error:', e);
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({
        content: '❌ Something went wrong.',
        embeds: [],
        components: [addApplicationRow()],
      }).catch(() => {});
    }
    return interaction.reply({
      content: '❌ Something went wrong.',
      components: [addApplicationRow()],
    }).catch(() => {});
  }
});

client.login(CONFIG.discordToken);

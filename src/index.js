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
  return interaction.user.id === CONFIG.ownerDiscordId;
}

function escapeMarkdown(s) {
  return String(s ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll('*', '\\*')
    .replaceAll('_', '\\_')
    .replaceAll('`', '\\`')
    .replaceAll('|', '\\|');
}

client.once('ready', async () => {
  const count = await registerGlobalCommands();
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`✅ Registered ${count} global commands`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    /* ================= AUTH ================= */

    if (interaction.commandName === 'auth') {
      if (!isOwner(interaction))
        return interaction.reply({ content: '❌ Not allowed.', ephemeral: true });

      const id = interaction.options.getString('userid', true);
      setUnlimited(id, true);

      return interaction.reply({
        content: `✅ <@${id}> is now **Unlimited**`,
        ephemeral: true,
      });
    }

    if (interaction.commandName === 'unauth') {
      if (!isOwner(interaction))
        return interaction.reply({ content: '❌ Not allowed.', ephemeral: true });

      const id = interaction.options.getString('userid', true);
      const user = setUnlimited(id, false);

      return interaction.reply({
        content: `🚫 Unlimited removed from <@${id}> — Trial left: **${user.trialUsesLeft}**`,
        ephemeral: true,
      });
    }

    if (interaction.commandName === 'authinfo') {
      if (!isOwner(interaction))
        return interaction.reply({ content: '❌ Not allowed.', ephemeral: true });

      const users = listUsers();
      const unlimited = users.filter(u => u.unlimited);
      const trial = users.filter(u => !u.unlimited);

      const lines = [];

      lines.push(`**Unlimited (${unlimited.length})**`);
      if (unlimited.length) {
        for (const u of unlimited) {
          lines.push(`• <@${u.id}> (\`${u.id}\`) — Unlimited`);
        }
      } else {
        lines.push('• none');
      }

      lines.push('');
      lines.push(`**Trial (${trial.length})**`);
      if (trial.length) {
        for (const u of trial) {
          lines.push(`• <@${u.id}> (\`${u.id}\`) — ${u.trialUsesLeft} left`);
        }
      } else {
        lines.push('• none');
      }

      return interaction.reply({
        content: lines.join('\n'),
        ephemeral: true,
      });
    }

    /* ================= PSE ================= */

    if (interaction.commandName === 'pse') {
      const record = getOrCreateUser(interaction.user.id);

      if (!record.unlimited && record.trialUsesLeft <= 0) {
        return interaction.reply({
          content: `❌ **You’ve used all free tries.**\nDM **M5** to purchase **Unlimited**.`,
          ephemeral: true,
          components: [addApplicationRow()],
        });
      }

      await interaction.deferReply();

      const userIds = await fetchGroupMemberUserIds(CONFIG.robloxGroupId);
      const presences = await fetchPresence(userIds);
      const online = presences.filter(p => p.userPresenceType !== 0);

      const basics = new Map();
      for (const p of online) {
        if (!basics.has(p.userId)) {
          basics.set(p.userId, await fetchUserBasics(p.userId));
        }
      }

      const placeIds = [...new Set(online.map(p => p.placeId).filter(Boolean))];
      const placeToUniverse = new Map();

      for (const placeId of placeIds) {
        const u = await placeIdToUniverseId(placeId);
        if (u) placeToUniverse.set(placeId, u);
      }

      const universeIds = [...new Set(placeToUniverse.values())];
      const games = await fetchGameInfoByUniverseIds(universeIds);
      const gameMap = new Map(games.map(g => [g.id, g.name]));

      const lines = [];

      for (const p of online) {
        const b = basics.get(p.userId);
        const display = escapeMarkdown(b.displayName);
        const username = escapeMarkdown(b.name);

        let game = 'Online';
        let join = '—';

        if (p.userPresenceType === 2 && p.placeId) {
          const universeId = placeToUniverse.get(p.placeId);
          game = gameMap.get(universeId) ?? 'In Game';
        }

        lines.push(`**${display} (${username})** | ${game} | ${join}`);
      }

      const embed = new EmbedBuilder()
        .setTitle('🟢 PSE – Players Online')
        .setDescription(lines.join('\n') || 'No players online.')
        .setFooter({
          text: record.unlimited
            ? 'Unlimited Access • Thanks for purchasing'
            : `Trial uses left: ${decrementTrialUse(interaction.user.id).trialUsesLeft} • DM M5 to get Unlimited`,
        })
        .setTimestamp();

      return interaction.editReply({
        embeds: [embed],
        components: [addApplicationRow()],
      });
    }
  } catch (err) {
    console.error(err);
    if (interaction.deferred || interaction.replied) {
      interaction.editReply({ content: '❌ Something went wrong.' });
    } else {
      interaction.reply({ content: '❌ Something went wrong.', ephemeral: true });
    }
  }
});

client.login(CONFIG.discordToken);

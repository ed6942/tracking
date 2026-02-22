const UA = 'pse-discord-bot/1.0';

async function rbxFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Roblox API ${res.status} for ${url} :: ${txt.slice(0, 300)}`);
  }
  return res.json();
}

export async function fetchGroupMemberUserIds(groupId) {
  const userIds = [];
  let cursor = null;

  while (true) {
    const url = new URL(`https://groups.roblox.com/v1/groups/${groupId}/users`);
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);

    const data = await rbxFetch(url.toString(), { method: 'GET' });
    for (const item of data.data ?? []) {
      if (item?.user?.userId) userIds.push(item.user.userId);
    }
    cursor = data.nextPageCursor;
    if (!cursor) break;
  }
  return userIds;
}

// Presence types (commonly used):
// 0 = Offline, 1 = Online, 2 = InGame, 3 = InStudio
export function presenceTypeToLabel(t) {
  switch (t) {
    case 1: return 'Online';
    case 2: return 'In Game';
    case 3: return 'In Studio';
    default: return 'Offline';
  }
}

export async function fetchPresence(userIds) {
  // Roblox presence endpoint accepts batches; keep it conservative.
  const chunks = [];
  for (let i = 0; i < userIds.length; i += 50) chunks.push(userIds.slice(i, i + 50));

  const results = [];
  for (const chunk of chunks) {
    const data = await rbxFetch('https://presence.roblox.com/v1/presence/users', {
      method: 'POST',
      body: JSON.stringify({ userIds: chunk }),
    });
    for (const u of data.userPresences ?? []) results.push(u);
  }
  return results;
}

export async function fetchUserBasics(userId) {
  // Per-user lookup (40 users => fine)
  return rbxFetch(`https://users.roblox.com/v1/users/${userId}`, { method: 'GET' });
}

export async function placeIdToUniverseId(placeId) {
  const data = await rbxFetch(`https://api.roblox.com/universes/get-universe-containing-place?placeid=${placeId}`, { method: 'GET' });
  // Response typically includes UniverseId
  const universeId = data?.UniverseId ?? data?.universeId;
  return universeId ? Number(universeId) : null;
}

export async function fetchGameInfoByUniverseIds(universeIds) {
  if (!universeIds.length) return [];
  const url = new URL('https://games.roblox.com/v1/games');
  url.searchParams.set('universeIds', universeIds.join(','));
  const data = await rbxFetch(url.toString(), { method: 'GET' });
  return data.data ?? [];
}

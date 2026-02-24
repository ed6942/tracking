import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'auth.json');

const DEFAULT_TRIAL_USES = 3;

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, JSON.stringify({ users: {} }, null, 2), 'utf-8');
  }
}

function readDb() {
  ensureFile();
  return JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8'));
}

function writeDb(db) {
  ensureFile();
  fs.writeFileSync(FILE_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

function newUser(overrides = {}) {
  const now = new Date().toISOString();
  return {
    unlimited: false,
    trialUsesLeft: DEFAULT_TRIAL_USES,
    blacklisted: false,
    blacklistReason: null,
    blacklistedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function getOrCreateUser(discordUserId) {
  const db = readDb();
  if (!db.users[discordUserId]) {
    db.users[discordUserId] = newUser();
    writeDb(db);
  } else {
    db.users[discordUserId] = { ...newUser(), ...db.users[discordUserId] };
    writeDb(db);
  }
  return db.users[discordUserId];
}

export function setUnlimited(discordUserId, unlimited) {
  const db = readDb();
  if (!db.users[discordUserId]) {
    db.users[discordUserId] = newUser({ unlimited: !!unlimited });
  } else {
    db.users[discordUserId] = { ...newUser(), ...db.users[discordUserId], unlimited: !!unlimited };
    db.users[discordUserId].updatedAt = new Date().toISOString();
  }
  writeDb(db);
  return db.users[discordUserId];
}

export function setBlacklisted(discordUserId, blacklisted, reason = null) {
  const db = readDb();
  if (!db.users[discordUserId]) {
    db.users[discordUserId] = newUser({
      blacklisted: !!blacklisted,
      blacklistReason: reason ?? null,
      blacklistedAt: blacklisted ? new Date().toISOString() : null,
    });
  } else {
    db.users[discordUserId] = { ...newUser(), ...db.users[discordUserId] };
    db.users[discordUserId].blacklisted = !!blacklisted;
    db.users[discordUserId].blacklistReason = blacklisted ? (reason ?? db.users[discordUserId].blacklistReason ?? null) : null;
    db.users[discordUserId].blacklistedAt = blacklisted ? (db.users[discordUserId].blacklistedAt ?? new Date().toISOString()) : null;
    db.users[discordUserId].updatedAt = new Date().toISOString();
  }
  writeDb(db);
  return db.users[discordUserId];
}

export function decrementTrialUse(discordUserId) {
  const db = readDb();
  if (!db.users[discordUserId]) {
    db.users[discordUserId] = newUser();
  } else {
    db.users[discordUserId] = { ...newUser(), ...db.users[discordUserId] };
  }

  const u = db.users[discordUserId];
  if (!u.unlimited) {
    u.trialUsesLeft = Math.max(0, Number(u.trialUsesLeft ?? 0) - 1);
    u.updatedAt = new Date().toISOString();
  }
  writeDb(db);
  return u;
}

export function listUsers() {
  const db = readDb();
  const users = db.users ?? {};
  return Object.entries(users).map(([id, data]) => ({ id, ...newUser(), ...data }));
}

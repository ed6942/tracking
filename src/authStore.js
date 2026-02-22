import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'auth.json');

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

export function getOrCreateUser(discordUserId) {
  const db = readDb();
  if (!db.users[discordUserId]) {
    db.users[discordUserId] = {
      unlimited: false,
      trialUsesLeft: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeDb(db);
  }
  return db.users[discordUserId];
}

export function getUser(discordUserId) {
  const db = readDb();
  return db.users[discordUserId] ?? null;
}

export function setUnlimited(discordUserId, unlimited) {
  const db = readDb();
  if (!db.users[discordUserId]) {
    db.users[discordUserId] = {
      unlimited: !!unlimited,
      trialUsesLeft: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } else {
    db.users[discordUserId].unlimited = !!unlimited;
    db.users[discordUserId].updatedAt = new Date().toISOString();
  }
  writeDb(db);
  return db.users[discordUserId];
}

export function decrementTrialUse(discordUserId) {
  const db = readDb();
  if (!db.users[discordUserId]) {
    db.users[discordUserId] = {
      unlimited: false,
      trialUsesLeft: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
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
  const entries = Object.entries(db.users ?? {}).map(([id, data]) => ({ id, ...data }));
  return entries;
}

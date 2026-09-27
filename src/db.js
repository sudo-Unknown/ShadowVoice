import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

// Ensure data folder exists
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new DatabaseSync(config.dbPath);

// Initialize Tables
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS calls (
      id TEXT PRIMARY KEY,
      caller_number TEXT,
      caller_name TEXT,
      channel TEXT DEFAULT 'phone',
      status TEXT DEFAULT 'in_progress',
      started_at TEXT,
      ended_at TEXT,
      duration_seconds INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transcripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      call_id TEXT NOT NULL,
      speaker TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (call_id) REFERENCES calls (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS voicemails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      call_id TEXT UNIQUE NOT NULL,
      caller_name TEXT,
      caller_phone TEXT,
      purpose TEXT,
      summary TEXT,
      action_items TEXT,
      urgency TEXT DEFAULT 'Medium',
      is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (call_id) REFERENCES calls (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed default settings if empty
  const getSettingStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const setSettingStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

  if (!getSettingStmt.get('owner_name')) {
    setSettingStmt.run('owner_name', config.owner.name);
  }
  if (!getSettingStmt.get('owner_role')) {
    setSettingStmt.run('owner_role', config.owner.role);
  }
  if (!getSettingStmt.get('owner_status')) {
    setSettingStmt.run('owner_status', config.owner.status);
  }
  if (!getSettingStmt.get('owner_bio')) {
    setSettingStmt.run('owner_bio', config.owner.bio);
  }
  if (!getSettingStmt.get('owner_email')) {
    setSettingStmt.run('owner_email', config.owner.email);
  }
  if (!getSettingStmt.get('custom_instructions')) {
    setSettingStmt.run('custom_instructions', 'Be courteous, concise, and helpful. Ask for their name and phone number if not yet provided. If the topic is an urgent production emergency, reassure them that Smit is notified immediately.');
  }
  if (!getSettingStmt.get('default_language')) {
    setSettingStmt.run('default_language', 'auto');
  }
}

// Calls & Transcripts Helper Methods
export function createCall({ id, caller_number = 'Unknown', caller_name = 'Unknown', channel = 'phone' }) {
  const started_at = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO calls (id, caller_number, caller_name, channel, status, started_at)
    VALUES (?, ?, ?, ?, 'in_progress', ?)
  `);
  stmt.run(id, caller_number, caller_name, channel, started_at);
  return { id, caller_number, caller_name, channel, started_at };
}

export function endCall(id) {
  const call = db.prepare('SELECT started_at FROM calls WHERE id = ?').get(id);
  const ended_at = new Date().toISOString();
  let duration = 0;
  if (call && call.started_at) {
    duration = Math.max(0, Math.round((new Date(ended_at).getTime() - new Date(call.started_at).getTime()) / 1000));
  }
  const stmt = db.prepare(`
    UPDATE calls
    SET status = 'completed', ended_at = ?, duration_seconds = ?
    WHERE id = ?
  `);
  stmt.run(ended_at, duration, id);
}

export function addTranscript({ call_id, speaker, text }) {
  const created_at = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO transcripts (call_id, speaker, text, created_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(call_id, speaker, text, created_at);
}

export function getTranscripts(call_id) {
  const stmt = db.prepare(`
    SELECT * FROM transcripts
    WHERE call_id = ?
    ORDER BY id ASC
  `);
  return stmt.all(call_id);
}

// Voicemails / Messages
function toSqlString(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  if (Array.isArray(val)) {
    return val.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join('\n• ');
  }
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  return String(val);
}

export function saveVoicemail({ call_id, caller_name, caller_phone, purpose, summary, action_items, urgency = 'Medium' }) {
  const created_at = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO voicemails (call_id, caller_name, caller_phone, purpose, summary, action_items, urgency, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    toSqlString(call_id),
    toSqlString(caller_name, 'Unknown'),
    toSqlString(caller_phone),
    toSqlString(purpose, 'Message'),
    toSqlString(summary),
    toSqlString(action_items),
    toSqlString(urgency, 'Medium'),
    created_at
  );
}

export function getVoicemails({ unreadOnly = false, limit = 50 } = {}) {
  let query = `
    SELECT v.*, c.channel, c.duration_seconds
    FROM voicemails v
    LEFT JOIN calls c ON v.call_id = c.id
  `;
  if (unreadOnly) {
    query += ` WHERE v.is_read = 0`;
  }
  query += ` ORDER BY v.id DESC LIMIT ?`;
  return db.prepare(query).all(limit);
}

export function getVoicemailDetails(call_id) {
  const vm = db.prepare(`
    SELECT v.*, c.channel, c.started_at, c.ended_at, c.duration_seconds
    FROM voicemails v
    LEFT JOIN calls c ON v.call_id = c.id
    WHERE v.call_id = ?
  `).get(call_id);

  if (!vm) return null;
  const transcripts = getTranscripts(call_id);
  return { ...vm, transcripts };
}

export function markVoicemailRead(call_id, is_read = 1) {
  const stmt = db.prepare(`
    UPDATE voicemails
    SET is_read = ?
    WHERE call_id = ?
  `);
  stmt.run(is_read ? 1 : 0, call_id);
}

export function deleteVoicemail(call_id) {
  db.prepare('DELETE FROM voicemails WHERE call_id = ?').run(call_id);
  db.prepare('DELETE FROM transcripts WHERE call_id = ?').run(call_id);
  db.prepare('DELETE FROM calls WHERE id = ?').run(call_id);
}

// Settings
export function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

export function updateSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function updateSettings(dict) {
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(dict)) {
    stmt.run(k, String(v));
  }
}

// Initialize on import
initDb();

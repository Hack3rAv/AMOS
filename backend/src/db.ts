import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'panel.sqlite');

let db: Database;

export async function initDB() {
    db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE TABLE IF NOT EXISTS active_event (
            id TEXT PRIMARY KEY,
            title TEXT,
            mode TEXT,
            arena_env TEXT,
            dimension TEXT,
            start_time TEXT,
            teams_json TEXT,
            players_json TEXT,
            status TEXT
        );

        CREATE TABLE IF NOT EXISTS event_history (
            id TEXT PRIMARY KEY,
            title TEXT,
            mode TEXT,
            winner TEXT,
            date TEXT,
            arena TEXT,
            timestamp INTEGER
        );
    `);

    const pass = await db.get(`SELECT value FROM settings WHERE key = 'master_password'`);
    if (!pass) {
        // Default password is 'admin'
        await db.run(`INSERT INTO settings (key, value) VALUES ('master_password', 'admin')`);
    }

    const ram = await db.get(`SELECT value FROM settings WHERE key = 'ram_allocation'`);
    if (!ram) {
        // Default 2GB
        await db.run(`INSERT INTO settings (key, value) VALUES ('ram_allocation', '2048')`);
    }

    console.log('Database initialized.');
}

export function getDB() {
    return db;
}

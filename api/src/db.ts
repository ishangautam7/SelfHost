import Database from 'better-sqlite3';
import path from 'path';

// Load the database from the project root
const dbPath = path.resolve(__dirname, '../../selfhost.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency (important since Rust is also writing to it)
db.pragma('journal_mode = WAL');

export default db;

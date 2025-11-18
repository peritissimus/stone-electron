import { defineConfig } from 'drizzle-kit';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Use DATABASE_URL from .env if available, otherwise use production path
const dbUrl = process.env.DATABASE_URL;
const dbPath = dbUrl
  ? path.isAbsolute(dbUrl)
    ? dbUrl
    : path.join(process.cwd(), dbUrl)
  : path.join(os.homedir(), 'Library', 'Application Support', 'stone', 'stone-data', 'notes.db');

export default defineConfig({
  schema: './src/main/database/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: dbPath,
  },
});

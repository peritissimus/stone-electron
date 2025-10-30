import { defineConfig } from 'drizzle-kit';
import path from 'path';
import os from 'os';

export default defineConfig({
  schema: './src/main/database/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'stone',
      'stone-data',
      'notes.db',
    ),
  },
});

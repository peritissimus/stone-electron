/**
 * Test script to debug blob storage in libsql
 */
import { createClient } from '@libsql/client/sqlite3';
import { drizzle } from 'drizzle-orm/libsql';
import { sql } from 'drizzle-orm';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../data/notes.db');

async function main() {
  console.log('Testing blob storage in libsql...\n');
  console.log('DB Path:', DB_PATH);

  // Create client
  const client = createClient({
    url: `file:${DB_PATH}`,
  });

  const db = drizzle(client);

  // Create a test embedding (384 floats for BGE-small)
  const testEmbedding = new Float32Array(384);
  for (let i = 0; i < 384; i++) {
    testEmbedding[i] = Math.random() * 2 - 1; // Random values between -1 and 1
  }

  console.log('Test embedding size:', testEmbedding.length, 'floats');
  console.log('First 5 values:', Array.from(testEmbedding.slice(0, 5)));

  // Convert to different formats and test
  const buffer = Buffer.from(testEmbedding.buffer);
  const uint8Array = new Uint8Array(testEmbedding.buffer);

  console.log('\nBuffer length:', buffer.length, 'bytes');
  console.log('Uint8Array length:', uint8Array.length, 'bytes');

  // Get a test note ID
  const noteResult = await db.all(sql`SELECT id FROM notes LIMIT 1`);
  if (noteResult.length === 0) {
    console.log('No notes found!');
    return;
  }

  const noteId = (noteResult[0] as { id: string }).id;
  console.log('\nTest note ID:', noteId);

  // Test 1: Try with Uint8Array
  console.log('\n--- Test 1: Uint8Array ---');
  try {
    await db.run(sql`UPDATE notes SET embedding = ${uint8Array} WHERE id = ${noteId}`);
    console.log('SUCCESS: Uint8Array works!');
  } catch (error) {
    console.log('FAILED:', (error as Error).message.substring(0, 100));
  }

  // Test 2: Try with Buffer
  console.log('\n--- Test 2: Buffer ---');
  try {
    await db.run(sql`UPDATE notes SET embedding = ${buffer} WHERE id = ${noteId}`);
    console.log('SUCCESS: Buffer works!');
  } catch (error) {
    console.log('FAILED:', (error as Error).message.substring(0, 100));
  }

  // Test 3: Try with raw SQL and hex
  console.log('\n--- Test 3: Hex string with X prefix ---');
  try {
    const hexString = Buffer.from(testEmbedding.buffer).toString('hex');
    await db.run(sql.raw(`UPDATE notes SET embedding = X'${hexString}' WHERE id = '${noteId}'`));
    console.log('SUCCESS: Hex string works!');
  } catch (error) {
    console.log('FAILED:', (error as Error).message.substring(0, 100));
  }

  // Test 4: Try with execute and raw params
  console.log('\n--- Test 4: Direct client execute ---');
  try {
    await client.execute({
      sql: 'UPDATE notes SET embedding = ? WHERE id = ?',
      args: [uint8Array, noteId],
    });
    console.log('SUCCESS: Direct client with Uint8Array works!');
  } catch (error) {
    console.log('FAILED:', (error as Error).message.substring(0, 100));
  }

  // Test 5: Try with ArrayBuffer
  console.log('\n--- Test 5: ArrayBuffer ---');
  try {
    await client.execute({
      sql: 'UPDATE notes SET embedding = ? WHERE id = ?',
      args: [testEmbedding.buffer, noteId],
    });
    console.log('SUCCESS: ArrayBuffer works!');
  } catch (error) {
    console.log('FAILED:', (error as Error).message.substring(0, 100));
  }

  // Test 6: Drizzle update with schema (this is what the app uses)
  console.log('\n--- Test 6: Drizzle update().set() with schema ---');
  try {
    // Import the schema
    const { notes } = await import('../src/main/database/schema.js');
    const { eq } = await import('drizzle-orm');

    await db
      .update(notes)
      .set({ embedding: uint8Array, updatedAt: new Date() })
      .where(eq(notes.id, noteId));
    console.log('SUCCESS: Drizzle update().set() with Uint8Array works!');
  } catch (error) {
    console.log('FAILED:', (error as Error).message.substring(0, 200));
  }

  // Test 7: Drizzle update with Buffer
  console.log('\n--- Test 7: Drizzle update().set() with Buffer ---');
  try {
    const { notes } = await import('../src/main/database/schema.js');
    const { eq } = await import('drizzle-orm');

    await db
      .update(notes)
      .set({ embedding: buffer, updatedAt: new Date() })
      .where(eq(notes.id, noteId));
    console.log('SUCCESS: Drizzle update().set() with Buffer works!');
  } catch (error) {
    console.log('FAILED:', (error as Error).message.substring(0, 200));
  }

  // Verify what was stored
  console.log('\n--- Verifying stored data ---');
  const verifyResult = await db.all(sql`SELECT embedding FROM notes WHERE id = ${noteId}`);
  const storedData = (verifyResult[0] as { embedding: unknown }).embedding;
  console.log('Stored data type:', typeof storedData);
  console.log('Is Buffer:', Buffer.isBuffer(storedData));
  console.log('Is Uint8Array:', storedData instanceof Uint8Array);
  console.log('Is ArrayBuffer:', storedData instanceof ArrayBuffer);
  if (storedData) {
    console.log('Stored data length:', (storedData as ArrayBuffer).byteLength || (storedData as Buffer).length);
  }

  client.close();
  console.log('\nDone!');
}

main().catch(console.error);

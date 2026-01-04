#!/usr/bin/env node
/**
 * Test script to verify @xenova/transformers works with polyfill
 * Run with: node scripts/test-transformers.mjs
 */

console.log('='.repeat(60));
console.log('Testing @xenova/transformers in Node.js environment');
console.log('='.repeat(60));

// Step 1: Check if 'self' exists
console.log('\n1. Checking globalThis.self before polyfill...');
console.log('   typeof globalThis.self:', typeof globalThis.self);

// Step 2: Apply polyfill
console.log('\n2. Applying polyfill: globalThis.self = globalThis');
if (typeof globalThis.self === 'undefined') {
  globalThis.self = globalThis;
}
console.log('   typeof globalThis.self after polyfill:', typeof globalThis.self);

// Step 3: Try to import transformers
console.log('\n3. Attempting to import @xenova/transformers...');
try {
  const { pipeline, env } = await import('@xenova/transformers');
  console.log('   SUCCESS: @xenova/transformers imported!');

  // Configure for Node.js
  env.allowLocalModels = true;
  env.useBrowserCache = false;

  console.log('\n4. Creating feature-extraction pipeline...');
  console.log('   Model: Xenova/bge-small-en-v1.5 (this may take a minute on first run)');

  const extractor = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', {
    quantized: true,
  });
  console.log('   SUCCESS: Pipeline created!');

  // Step 5: Test embedding
  console.log('\n5. Testing embedding generation...');
  const testText = 'Hello, this is a test of the embedding service.';
  const output = await extractor(testText, { pooling: 'mean', normalize: true });

  const embedding = Array.from(output.data);
  console.log('   SUCCESS: Embedding generated!');
  console.log('   Dimensions:', embedding.length);
  console.log('   First 5 values:', embedding.slice(0, 5).map(v => v.toFixed(4)));

  console.log('\n' + '='.repeat(60));
  console.log('ALL TESTS PASSED!');
  console.log('='.repeat(60));

} catch (error) {
  console.error('   FAILED:', error.message);
  console.error('\nFull error:');
  console.error(error);
  process.exit(1);
}

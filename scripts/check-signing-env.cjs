// Validate names only. Never include credential values in build output.
function missingSigningVariables(env) {
  const missing = ['CSC_NAME', 'CSC_LINK', 'CSC_KEY_PASSWORD'].filter((name) => !env[name]);
  const appleId = ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'];
  const apiKey = ['APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER'];
  if (!appleId.every((name) => env[name]) && !apiKey.every((name) => env[name])) {
    missing.push(`notarization credentials (${appleId.join(', ')} or ${apiKey.join(', ')})`);
  }
  return missing;
}

if (require.main === module) {
  const missing = missingSigningVariables(process.env);
  if (missing.length) {
    console.error(`Signed packaging requires: ${missing.join('; ')}`);
    process.exitCode = 1;
  }
}

module.exports = { missingSigningVariables };

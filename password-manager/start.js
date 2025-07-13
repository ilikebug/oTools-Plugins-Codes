#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Password Manager with OAuth Server...');

// Start OAuth server
const oauthServer = spawn('node', ['oauth-server.js'], {
  cwd: __dirname,
  stdio: 'inherit'
});

console.log('✅ OAuth server started on http://localhost:3000');

// Wait a moment for the server to start
setTimeout(() => {
  console.log('📱 Password Manager is ready!');
  console.log('🔗 OAuth callback URL: http://localhost:3000/callback');
  console.log('');
  console.log('📝 Setup Instructions:');
  console.log('1. Update GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in preload.js');
  console.log('2. Configure redirect URI as http://localhost:3000/callback in Google Cloud Console');
  console.log('3. Open the password manager and click "Connect" to start OAuth flow');
  console.log('');
}, 1000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  oauthServer.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down...');
  oauthServer.kill();
  process.exit(0);
});

// Handle OAuth server errors
oauthServer.on('error', (error) => {
  console.error('❌ OAuth server error:', error);
});

oauthServer.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ OAuth server exited with code ${code}`);
  }
}); 
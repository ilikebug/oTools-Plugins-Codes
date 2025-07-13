#!/usr/bin/env node

// Tool to generate secure configuration for Google API credentials
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔐 Google API 安全配置生成器');
console.log('================================');

// Simple obfuscation function
const obfuscate = (str) => {
  return Buffer.from(str).toString('base64');
};

// Generate secure configuration
async function generateConfig() {
  try {
    // Get Client ID
    const clientId = await new Promise((resolve) => {
      rl.question('请输入您的 Google Client ID: ', resolve);
    });

    // Get Client Secret
    const clientSecret = await new Promise((resolve) => {
      rl.question('请输入您的 Google Client Secret: ', resolve);
    });

    // Generate obfuscated values
    const obfuscatedClientId = obfuscate(clientId);
    const obfuscatedClientSecret = obfuscate(clientSecret);

    console.log('\n✅ 生成的混淆配置:');
    console.log('================================');
    console.log(`OBFUSCATED_CLIENT_ID = '${obfuscatedClientId}'`);
    console.log(`OBFUSCATED_CLIENT_SECRET = '${obfuscatedClientSecret}'`);
    console.log('\n📝 请将这些值复制到 secure-config.js 文件中');

    // Generate the complete secure-config.js content
    const configContent = `// Secure configuration for Google API credentials
// This module provides a way to store credentials more securely

// Simple obfuscation to prevent easy extraction
const obfuscate = (str) => {
  return Buffer.from(str).toString('base64');
};

const deobfuscate = (str) => {
  return Buffer.from(str, 'base64').toString();
};

// Obfuscated credentials
const OBFUSCATED_CLIENT_ID = '${obfuscatedClientId}';
const OBFUSCATED_CLIENT_SECRET = '${obfuscatedClientSecret}';

// Export secure configuration
module.exports = {
  getClientId: () => deobfuscate(OBFUSCATED_CLIENT_ID),
  getClientSecret: () => deobfuscate(OBFUSCATED_CLIENT_SECRET),
  getRedirectUri: () => 'http://localhost:3000/callback'
};
`;

    console.log('\n📄 完整的 secure-config.js 文件内容:');
    console.log('================================');
    console.log(configContent);

    rl.close();
  } catch (error) {
    console.error('❌ 生成配置时出错:', error.message);
    rl.close();
  }
}

generateConfig(); 
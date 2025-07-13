// Secure configuration for Google API credentials
// This module provides a way to store credentials more securely

// Simple obfuscation to prevent easy extraction
const obfuscate = (str) => {
  return Buffer.from(str).toString('base64');
};

const deobfuscate = (str) => {
  return Buffer.from(str, 'base64').toString();
};

// Obfuscated credentials
const OBFUSCATED_CLIENT_ID = 'OTIwMzQ4MjkwMjYyLTUxNWkya2t1cDVqZ3AwNzVmdmRpdjhhaXNlZjc4ZHE2LmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29t';
const OBFUSCATED_CLIENT_SECRET = 'R09DU1BYLXlaNVZNRXRzcjh3WEp5RjlsY1Zfa0NCVFBWVGY=';

// Export secure configuration
module.exports = {
  getClientId: () => deobfuscate(OBFUSCATED_CLIENT_ID),
  getClientSecret: () => deobfuscate(OBFUSCATED_CLIENT_SECRET),
  getRedirectUri: () => `http://localhost:${process.env.OAUTH_PORT || 10000}/callback`
}; 
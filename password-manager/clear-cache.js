#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧹 Clearing local cache...');

// Clear Node.js module cache
function clearModuleCache() {
      console.log('📦 Clearing Node.js module cache...');
  
  // Get all loaded modules
  const moduleIds = Object.keys(require.cache);
  
  // Filter project-related modules
  const projectModules = moduleIds.filter(id => 
    id.includes(__dirname) && 
    !id.includes('node_modules')
  );
  
  // Clear project module cache
  projectModules.forEach(id => {
    delete require.cache[id];
            console.log(`✅ Cleared module cache: ${path.basename(id)}`);
  });
  
      console.log(`📊 Cleared ${projectModules.length} module caches`);
}

// Clear build cache
function clearBuildCache() {
      console.log('🔨 Clearing build cache...');
  
  const distPath = path.join(__dirname, 'dist');
  if (fs.existsSync(distPath)) {
    // Delete dist directory
    fs.rmSync(distPath, { recursive: true, force: true });
          console.log('✅ Cleared dist directory');
  }
  
  // Delete webpack cache
  const webpackCachePath = path.join(__dirname, 'node_modules', '.cache');
  if (fs.existsSync(webpackCachePath)) {
    fs.rmSync(webpackCachePath, { recursive: true, force: true });
    console.log('✅ Cleared webpack cache');
  }
}

// Clear npm cache
function clearNpmCache() {
      console.log('📦 Clearing npm cache...');
  
  const { execSync } = require('child_process');
  try {
    execSync('npm cache clean --force', { stdio: 'inherit' });
          console.log('✅ npm cache cleared');
  } catch (error) {
          console.log('⚠️  npm cache clearing failed, may need administrator privileges');
  }
}

// Clear OAuth-related cache
function clearOAuthCache() {
      console.log('🔐 Clearing OAuth-related cache...');
  
  // Clear possible token cache
  const tokenCachePath = path.join(__dirname, 'token-cache.json');
  if (fs.existsSync(tokenCachePath)) {
    fs.unlinkSync(tokenCachePath);
          console.log('✅ Cleared token cache');
  }
  
  // Clear possible authentication state cache
  const authCachePath = path.join(__dirname, 'auth-cache.json');
  if (fs.existsSync(authCachePath)) {
    fs.unlinkSync(authCachePath);
          console.log('✅ Cleared authentication state cache');
  }
}

// Main function
function clearAllCache() {
  try {
    clearModuleCache();
    clearBuildCache();
    clearNpmCache();
    clearOAuthCache();
    
    console.log('\n🎉 All cache cleared!');
    console.log('💡 Recommended to reinstall dependencies: npm install');
    console.log('💡 Then rebuild: npm run build:plugin');
    
  } catch (error) {
    console.error('❌ Error clearing cache:', error.message);
  }
}

// If this script is run directly
if (require.main === module) {
  clearAllCache();
}

module.exports = {
  clearModuleCache,
  clearBuildCache,
  clearNpmCache,
  clearOAuthCache,
  clearAllCache
}; 
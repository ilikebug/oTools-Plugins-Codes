#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔨 Start building Screenshot OCR plugin...');

// Check if dist directory exists
const distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
  console.log('❌ dist directory does not exist. Please run npm run build first.');
  process.exit(1);
}

// Copy necessary files to dist directory
const filesToCopy = [
  'index.html',
  'index.css',
  'icon.png',
  'plugin.json'
];

console.log('📁 Copying static files...');
filesToCopy.forEach(file => {
  const sourcePath = path.join(__dirname, file);
  const destPath = path.join(distPath, file);
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`✅ Copied ${file}`);
  } else {
    console.log(`⚠️  File does not exist: ${file}`);
  }
});

// Update plugin.json path
const pluginJsonPath = path.join(distPath, 'plugin.json');
if (fs.existsSync(pluginJsonPath)) {
  const pluginConfig = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
  
  // Update HTML file path
  if (pluginConfig.ui && pluginConfig.ui.html) {
    pluginConfig.ui.html = 'index.html';
  }
  
  fs.writeFileSync(pluginJsonPath, JSON.stringify(pluginConfig, null, 2));
  console.log('✅ Updated plugin.json');
}

console.log('\n🎉 Build complete!');
console.log('📁 Compiled files are in the dist/ directory'); 
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Function to recursively copy directories
function copyDirectory(source, destination) {
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }
  
  const items = fs.readdirSync(source);
  
  for (const item of items) {
    const sourcePath = path.join(source, item);
    const destPath = path.join(destination, item);
    
    const stat = fs.statSync(sourcePath);
    
    if (stat.isDirectory()) {
      copyDirectory(sourcePath, destPath);
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

console.log('🔨 Start building Password Manager plugin...');

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

// Dependencies to copy
const dependenciesToCopy = [
  'googleapis',
  'otplib',
  'electron-store'
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

// Copy dependencies to dist directory
console.log('📦 Copying dependencies...');
dependenciesToCopy.forEach(dep => {
  const sourcePath = path.join(__dirname, 'node_modules', dep);
  const destPath = path.join(distPath, 'node_modules', dep);
  
  if (fs.existsSync(sourcePath)) {
    // Ensure target directory exists
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    // Copy entire dependency directory
    copyDirectory(sourcePath, destPath);
          console.log(`✅ Copied dependency ${dep}`);
} else {
  console.log(`⚠️  Dependency does not exist: ${dep}`);
}
}); 

// Update paths in plugin.json
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

// Create startup script
const startScript = `#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

// Start the compiled application
const electronPath = require('electron');
const appPath = path.join(__dirname);

const child = spawn(electronPath, [appPath], {
  stdio: 'inherit',
  env: process.env
});

child.on('close', (code) => {
  process.exit(code);
});
`;

fs.writeFileSync(path.join(distPath, 'start.js'), startScript);
console.log('✅ Created startup script');

console.log('\n🎉 Build complete!');
console.log('📁 Compiled files are in the dist/ directory');
console.log('🚀 Run: cd dist && npm start'); 
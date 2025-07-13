#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔨 开始构建截图OCR插件...');

// 检查dist目录是否存在
const distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
  console.log('❌ dist目录不存在，请先运行 npm run build');
  process.exit(1);
}

// 复制必要的文件到dist目录
const filesToCopy = [
  'index.html',
  'index.css',
  'icon.png',
  'plugin.json'
];

console.log('📁 复制静态文件...');
filesToCopy.forEach(file => {
  const sourcePath = path.join(__dirname, file);
  const destPath = path.join(distPath, file);
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`✅ 复制 ${file}`);
  } else {
    console.log(`⚠️  文件不存在: ${file}`);
  }
});

// 更新plugin.json中的路径
const pluginJsonPath = path.join(distPath, 'plugin.json');
if (fs.existsSync(pluginJsonPath)) {
  const pluginConfig = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
  
  // 更新HTML文件路径
  if (pluginConfig.ui && pluginConfig.ui.html) {
    pluginConfig.ui.html = 'index.html';
  }
  
  fs.writeFileSync(pluginJsonPath, JSON.stringify(pluginConfig, null, 2));
  console.log('✅ 更新 plugin.json');
}

console.log('\n🎉 构建完成！');
console.log('📁 编译后的文件在 dist/ 目录中'); 
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔨 开始构建密码管理器插件...');

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
  'plugin.json',
  'oauth-callback.html'
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

// 创建启动脚本
const startScript = `#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

// 启动编译后的应用
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
console.log('✅ 创建启动脚本');

console.log('\n🎉 构建完成！');
console.log('📁 编译后的文件在 dist/ 目录中');
console.log('🚀 运行: cd dist && npm start'); 
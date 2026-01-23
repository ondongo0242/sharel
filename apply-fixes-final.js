#!/usr/bin/env node
/**
 * Script final pour appliquer les 5 fixes Kotlin à withHotspotNative.js
 * Utilise les replacements du fichier KOTLIN_FIXES.js
 */

const fs = require('fs');
const path = require('path');

const pluginPath = path.join(__dirname, 'plugins', 'withHotspotNative.js');
const fixesPath = path.join(__dirname, 'KOTLIN_FIXES.js');

console.log('📖 Reading plugin file...');
let content = fs.readFileSync(pluginPath, 'utf-8');
console.log(`Original size: ${(content.length / 1024).toFixed(2)} KB`);

// Load the fixes file
const fixesCode = fs.readFileSync(fixesPath, 'utf-8');

// Extract the fixed modules from KOTLIN_FIXES.js
const hotspotMatch = fixesCode.match(/const HOTSPOT_MODULE_KT_FIXED = `([\s\S]*?)`;\n/);
const logMatch = fixesCode.match(/const LOG_MODULE_KT_FIXED = `([\s\S]*?)`;\n/);
const fileExplorerMatch = fixesCode.match(/const FILE_EXPLORER_MODULE_KT_FIXED = `([\s\S]*?)`;\n/);
const mediaGalleryMatch = fixesCode.match(/const MEDIA_GALLERY_MODULE_KT_FIXED = `([\s\S]*?)`;\n/);
const wifiDirectMatch = fixesCode.match(/const WIFI_DIRECT_MODULE_KT_FIXED = `([\s\S]*?)`;\n/);

if (!hotspotMatch || !logMatch) {
  console.error('❌ Could not extract fixes from KOTLIN_FIXES.js');
  process.exit(1);
}

// Replace HotspotModule
console.log('🔧 Replacing HotspotModule...');
const hotspotStart = content.indexOf('const HOTSPOT_MODULE_KT = `package com.sharel.app');
const hotspotEnd = content.indexOf('`;\n\nconst HTTP_SERVER_MODULE_KT', hotspotStart);

if (hotspotStart !== -1 && hotspotEnd !== -1) {
  const newHotspot = `const HOTSPOT_MODULE_KT = \`${hotspotMatch[1]}\``;
  content = content.substring(0, hotspotStart) + newHotspot + content.substring(hotspotEnd);
  console.log('✅ HotspotModule replaced');
} else {
  console.error('❌ Could not find HotspotModule boundaries');
  process.exit(1);
}

// Replace LogModule
console.log('🔧 Replacing LogModule...');
const logStart = content.indexOf('const LOG_MODULE_KT = `package com.sharel.app');
const logEnd = content.indexOf('`;\n\nconst SHAREL_PACKAGE_KT', logStart);

if (logStart !== -1 && logEnd !== -1) {
  const newLog = `const LOG_MODULE_KT = \`${logMatch[1]}\``;
  content = content.substring(0, logStart) + newLog + content.substring(logEnd);
  console.log('✅ LogModule replaced');
} else {
  console.error('❌ Could not find LogModule boundaries');
  process.exit(1);
}

// Replace FileExplorerModule if found
if (fileExplorerMatch) {
  console.log('🔧 Replacing FileExplorerModule...');
  const fileExplorerStart = content.indexOf('const FILE_EXPLORER_MODULE_KT = `package com.sharel.app');
  const fileExplorerEnd = content.indexOf('`;\n\nconst MEDIA_GALLERY_MODULE_KT', fileExplorerStart);
  
  if (fileExplorerStart !== -1 && fileExplorerEnd !== -1) {
    const newFileExplorer = `const FILE_EXPLORER_MODULE_KT = \`${fileExplorerMatch[1]}\``;
    content = content.substring(0, fileExplorerStart) + newFileExplorer + content.substring(fileExplorerEnd);
    console.log('✅ FileExplorerModule replaced');
  }
}

// Replace MediaGalleryModule if found
if (mediaGalleryMatch) {
  console.log('🔧 Replacing MediaGalleryModule...');
  const mediaStart = content.indexOf('const MEDIA_GALLERY_MODULE_KT = `package com.sharel.app');
  const mediaEnd = content.indexOf('`;\n\nconst CONTACTS_MODULE_KT', mediaStart);
  
  if (mediaStart !== -1 && mediaEnd !== -1) {
    const newMedia = `const MEDIA_GALLERY_MODULE_KT = \`${mediaGalleryMatch[1]}\``;
    content = content.substring(0, mediaStart) + newMedia + content.substring(mediaEnd);
    console.log('✅ MediaGalleryModule replaced');
  }
}

// Replace WifiDirectModule if found
if (wifiDirectMatch) {
  console.log('🔧 Replacing WifiDirectModule...');
  const wifiStart = content.indexOf('const WIFI_DIRECT_MODULE_KT = `package com.sharel.app');
  const wifiEnd = content.indexOf('`;\n\nconst APPS_MODULE_KT', wifiStart);
  
  if (wifiStart !== -1 && wifiEnd !== -1) {
    const newWifi = `const WIFI_DIRECT_MODULE_KT = \`${wifiDirectMatch[1]}\``;
    content = content.substring(0, wifiStart) + newWifi + content.substring(wifiEnd);
    console.log('✅ WifiDirectModule replaced');
  }
}

// Write back
fs.writeFileSync(pluginPath, content);
console.log(`\n✅ All fixes applied!`);
console.log(`Final size: ${(content.length / 1024).toFixed(2)} KB`);

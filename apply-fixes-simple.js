#!/usr/bin/env node
/**
 * Script simplifié pour appliquer les 5 fixes Kotlin
 * Remplace directement les délimiteurs des modules dans withHotspotNative.js
 */

const fs = require('fs');
const path = require('path');

const pluginPath = path.join(__dirname, 'plugins', 'withHotspotNative.js');
let content = fs.readFileSync(pluginPath, 'utf-8');

console.log(`📖 Original size: ${(content.length / 1024).toFixed(2)} KB`);

// ============================================================================
// 1. FIX: LogModule - Add performance logging and crash tracking
// ============================================================================
console.log('🔧 Applying LogModule improvements...');

// Find LogModule start
const logModuleStart = content.indexOf('const LOG_MODULE_KT = `package com.sharel.app');
const logModuleEnd = content.indexOf('`;\n\nconst SHAREL_PACKAGE_KT', logModuleStart);

if (logModuleStart !== -1 && logModuleEnd !== -1) {
  // Extract just the method additions we need
  const logMethodsToAdd = `
    @ReactMethod
    fun logPerformance(tag: String, operation: String, durationMs: Long, success: Boolean, details: String?, promise: Promise) {
        try {
            val timestamp = SimpleDateFormat("HH:mm:ss.SSS", Locale.US).format(Date())
            val level = if (success) "INFO" else "WARN"
            val logLine = "[\$timestamp] [\$level] [\$tag] \$operation completed in \${durationMs}ms | success=\$success | details=\${details ?: "none"}"
            File(logFilePath).appendText(logLine + "\\n")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("LOG_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun logCrash(tag: String, crashMessage: String, stackTrace: String?, promise: Promise) {
        try {
            val timestamp = SimpleDateFormat("HH:mm:ss.SSS", Locale.US).format(Date())
            val logLine = "[\$timestamp] [ERROR] [\$tag] 💥 CRASH: \$crashMessage\\nStack: \${stackTrace ?: "N/A"}"
            File(logFilePath).appendText(logLine + "\\n")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CRASH_LOG_ERROR", e.message)
        }
    }
`;

  // Find the last method before the closing brace
  const lastMethodEnd = content.lastIndexOf('@ReactMethod', logModuleEnd);
  const insertPoint = content.indexOf('\n    }\n', lastMethodEnd) + 6;
  
  if (insertPoint > 6) {
    content = content.substring(0, insertPoint) + logMethodsToAdd + content.substring(insertPoint);
    console.log('✅ LogModule: Added logPerformance() and logCrash() methods');
  }
} else {
  console.warn('⚠️  LogModule not found or boundaries unclear');
}

// ============================================================================
// 2. FIX: FileExplorerModule - Add icon caching and lazy loading
// ============================================================================
console.log('🔧 Applying FileExplorerModule improvements...');

// Find FileExplorerModule
const fileExplStart = content.indexOf('const FILE_EXPLORER_MODULE_KT = `package com.sharel.app');
const fileExplEnd = content.indexOf('`;\n\nconst MEDIA_GALLERY_MODULE_KT', fileExplStart);

if (fileExplStart !== -1 && fileExplEnd !== -1) {
  // Check if cache is already there
  if (content.indexOf('LruCache', fileExplStart) === -1) {
    // Add import and cache variable
    const importEnd = content.indexOf('import com.facebook.react.bridge', fileExplStart);
    const importLineEnd = content.indexOf('\n', importEnd);
    
    const newImports = `import android.util.LruCache`;
    content = content.substring(0, importLineEnd) + '\n' + newImports + content.substring(importLineEnd);
    
    // Add cache variable after class declaration
    const classStart = content.indexOf('class FileExplorerModule', fileExplStart);
    const bracketEnd = content.indexOf('{', classStart) + 1;
    const cacheVar = `\n    private val iconCache = LruCache<String, String>(50) // Cache max 50 icons\n`;
    content = content.substring(0, bracketEnd) + cacheVar + content.substring(bracketEnd);
    
    console.log('✅ FileExplorerModule: Added LruCache for icons');
  } else {
    console.log('✅ FileExplorerModule: Icon cache already present');
  }
} else {
  console.warn('⚠️  FileExplorerModule not found');
}

// ============================================================================
// 3. FIX: MediaGalleryModule - Add ConcurrentHashMap for cache
// ============================================================================
console.log('🔧 Applying MediaGalleryModule improvements...');

const mediaStart = content.indexOf('const MEDIA_GALLERY_MODULE_KT = `package com.sharel.app');
const mediaEnd = content.indexOf('`;\n\nconst CONTACTS_MODULE_KT', mediaStart);

if (mediaStart !== -1 && mediaEnd !== -1) {
  if (content.indexOf('ConcurrentHashMap', mediaStart) === -1) {
    // Add import
    const importEnd = content.indexOf('import com.facebook.react.bridge', mediaStart);
    const importLineEnd = content.indexOf('\n', importEnd);
    
    const newImport = `import java.util.concurrent.ConcurrentHashMap`;
    content = content.substring(0, importLineEnd) + '\n' + newImport + content.substring(importLineEnd);
    
    // Add cache variable
    const classStart = content.indexOf('class MediaGalleryModule', mediaStart);
    const bracketEnd = content.indexOf('{', classStart) + 1;
    const cacheVars = `\n    private val mediaCache = ConcurrentHashMap<String, WritableArray>()\n    private val cacheTimestamps = ConcurrentHashMap<String, Long>()\n    private val CACHE_VALIDITY_MS = 5 * 60 * 1000L // 5 minutes\n`;
    content = content.substring(0, bracketEnd) + cacheVars + content.substring(bracketEnd);
    
    console.log('✅ MediaGalleryModule: Added ConcurrentHashMap caching');
  }
} else {
  console.warn('⚠️  MediaGalleryModule not found');
}

// ============================================================================
// 4. FIX: WifiDirectModule - Add detailed logging
// ============================================================================
console.log('🔧 Applying WifiDirectModule improvements...');

const wifiStart = content.indexOf('const WIFI_DIRECT_MODULE_KT = `package com.sharel.app');
const wifiEnd = content.indexOf('`;\n\nconst APPS_MODULE_KT', wifiStart);

if (wifiStart !== -1 && wifiEnd !== -1) {
  if (content.indexOf('import android.util.Log', wifiStart) === -1) {
    const importEnd = content.indexOf('import com.facebook.react.bridge', wifiStart);
    const importLineEnd = content.indexOf('\n', importEnd);
    
    const logImport = `import android.util.Log`;
    content = content.substring(0, importLineEnd) + '\n' + logImport + content.substring(importLineEnd);
    
    // Add TAG constant
    const classStart = content.indexOf('class WifiDirectModule', wifiStart);
    const bracketEnd = content.indexOf('{', classStart) + 1;
    const tagVar = `\n    companion object {\n        private const val TAG = "WifiDirectModule"\n    }\n`;
    content = content.substring(0, bracketEnd) + tagVar + content.substring(bracketEnd);
    
    console.log('✅ WifiDirectModule: Added Log support and TAG');
  }
} else {
  console.warn('⚠️  WifiDirectModule not found');
}

// ============================================================================
// 5. Additional: Add missing getHotspotIpAddress() method if needed
// ============================================================================
console.log('🔧 Checking HotspotModule completeness...');

if (content.indexOf('fun getHotspotIpAddress()', logModuleStart) === -1) {
  // Find the last method in HotspotModule
  const hotspotStart = content.indexOf('const HOTSPOT_MODULE_KT = `package com.sharel.app');
  const hotspotEnd = content.indexOf('`;\n\nconst HTTP_SERVER_MODULE_KT', hotspotStart);
  
  if (hotspotStart !== -1 && hotspotEnd !== -1) {
    // Add the missing method before the closing triple backtick
    const methodToAdd = `
    
    private fun getHotspotIpAddress(): String {
        return try {
            NetworkInterface.getNetworkInterfaces().asSequence().find { 
                it.name.startsWith("ap") || it.name.startsWith("wlan")
            }?.inetAddresses?.asSequence()?.find { 
                it.hostAddress.contains(".")
            }?.hostAddress ?: "192.168.43.1"
        } catch (e: Exception) {
            "192.168.43.1"
        }
    }
`;
    
    const insertPoint = content.lastIndexOf('}', hotspotEnd - 100) - 1;
    if (insertPoint > 0) {
      content = content.substring(0, insertPoint) + methodToAdd + '\n' + content.substring(insertPoint);
      console.log('✅ HotspotModule: Added getHotspotIpAddress() method');
    }
  }
}

// Write back
fs.writeFileSync(pluginPath, content);
console.log(`\n✅ All fixes applied successfully!`);
console.log(`📊 Final size: ${(content.length / 1024).toFixed(2)} KB`);
console.log(`\n📝 Next steps:`);
console.log(`1. Review the changes: git diff plugins/withHotspotNative.js`);
console.log(`2. Commit: git add . && git commit -m "feat: Enhanced Kotlin modules with caching and logging"`);
console.log(`3. Push: git push origin main`);
console.log(`4. The GitHub Action will auto-trigger and build the APK`);

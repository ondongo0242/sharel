package com.sharel.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File

class StorageModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {
    
    private var pendingPromise: Promise? = null
    private val REQUEST_CODE_MANAGE_STORAGE = 1001
    
    init {
        reactContext.addActivityEventListener(this)
    }
    
    override fun getName(): String = "StorageModule"
    
    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
    
    @ReactMethod
    fun hasManageStoragePermission(promise: Promise) {
        try {
            val hasPermission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Environment.isExternalStorageManager()
            } else {
                true
            }
            promise.resolve(hasPermission)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to check permission: ${e.message}")
        }
    }
    
    @ReactMethod
    fun requestManageStoragePermission(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            promise.resolve(true)
            return
        }
        
        if (Environment.isExternalStorageManager()) {
            promise.resolve(true)
            return
        }
        
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No activity available")
            return
        }
        
        pendingPromise = promise
        
        try {
            val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION)
            intent.data = Uri.parse("package:${reactApplicationContext.packageName}")
            activity.startActivity(intent)
        } catch (e: Exception) {
            try {
                val intent = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
                activity.startActivity(intent)
            } catch (e2: Exception) {
                pendingPromise = null
                promise.reject("ERROR", "Cannot open storage permission settings: ${e2.message}")
            }
        }
    }
    
    @ReactMethod
    fun openStoragePermissionSettings(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            promise.resolve(false)
            return
        }
        
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No activity available")
            return
        }
        
        pendingPromise = promise
        
        try {
            val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION)
            intent.data = Uri.parse("package:${reactApplicationContext.packageName}")
            activity.startActivity(intent)
        } catch (e: Exception) {
            try {
                val intent = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
                activity.startActivity(intent)
            } catch (e2: Exception) {
                pendingPromise = null
                promise.reject("ERROR", "Cannot open storage settings: ${e2.message}")
            }
        }
    }
    
    @ReactMethod
    fun createSharelFolder(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && !Environment.isExternalStorageManager()) {
                promise.reject("NO_PERMISSION", "MANAGE_EXTERNAL_STORAGE permission required")
                return
            }
            
            val rootPath = Environment.getExternalStorageDirectory().absolutePath
            val sharelDir = File(rootPath, "Sharel")
            
            if (sharelDir.exists()) {
                val result = Arguments.createMap().apply {
                    putBoolean("success", true)
                    putString("path", sharelDir.absolutePath)
                    putBoolean("alreadyExists", true)
                }
                promise.resolve(result)
                return
            }
            
            val created = sharelDir.mkdirs()
            
            if (created) {
                createSubfolders(sharelDir)
                
                val result = Arguments.createMap().apply {
                    putBoolean("success", true)
                    putString("path", sharelDir.absolutePath)
                    putBoolean("alreadyExists", false)
                }
                promise.resolve(result)
                
                val event = Arguments.createMap().apply {
                    putString("event", "folder_created")
                    putString("path", sharelDir.absolutePath)
                }
                sendEvent("onStorageEvent", event)
            } else {
                promise.reject("CREATE_FAILED", "Failed to create Sharel folder at: $rootPath/Sharel")
            }
        } catch (e: SecurityException) {
            promise.reject("SECURITY_ERROR", "Permission denied: ${e.message}")
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to create folder: ${e.message}")
        }
    }
    
    private fun createSubfolders(parentDir: File) {
        val subfolders = listOf(
            "Downloads",
            "Photos",
            "Videos",
            "Music",
            "Documents",
            "Apps",
            "Others"
        )
        
        subfolders.forEach { subfolder ->
            val dir = File(parentDir, subfolder)
            if (!dir.exists()) {
                dir.mkdirs()
            }
        }
    }
    
    @ReactMethod
    fun getSharelFolderPath(promise: Promise) {
        try {
            val rootPath = Environment.getExternalStorageDirectory().absolutePath
            val sharelDir = File(rootPath, "Sharel")
            
            val result = Arguments.createMap().apply {
                putString("path", sharelDir.absolutePath)
                putBoolean("exists", sharelDir.exists())
                putBoolean("isDirectory", sharelDir.isDirectory)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to get folder path: ${e.message}")
        }
    }
    
    @ReactMethod
    fun listSharelFolder(promise: Promise) {
        try {
            val rootPath = Environment.getExternalStorageDirectory().absolutePath
            val sharelDir = File(rootPath, "Sharel")
            
            if (!sharelDir.exists()) {
                promise.reject("NOT_EXISTS", "Sharel folder does not exist")
                return
            }
            
            val files = sharelDir.listFiles()?.map { file ->
                Arguments.createMap().apply {
                    putString("name", file.name)
                    putString("path", file.absolutePath)
                    putBoolean("isDirectory", file.isDirectory)
                    putDouble("size", file.length().toDouble())
                    putDouble("lastModified", file.lastModified().toDouble())
                }
            } ?: emptyList()
            
            val result = Arguments.createArray()
            files.forEach { result.pushMap(it) }
            
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to list folder: ${e.message}")
        }
    }
    
    @ReactMethod
    fun saveFileToSharel(sourcePath: String, fileName: String, subfolder: String, promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && !Environment.isExternalStorageManager()) {
                promise.reject("NO_PERMISSION", "MANAGE_EXTERNAL_STORAGE permission required")
                return
            }
            
            val rootPath = Environment.getExternalStorageDirectory().absolutePath
            val destDir = if (subfolder.isNotEmpty()) {
                File(rootPath, "Sharel/$subfolder")
            } else {
                File(rootPath, "Sharel")
            }
            
            if (!destDir.exists()) {
                destDir.mkdirs()
            }
            
            val sourceFile = File(sourcePath)
            if (!sourceFile.exists()) {
                promise.reject("SOURCE_NOT_FOUND", "Source file not found: $sourcePath")
                return
            }
            
            val destFile = File(destDir, fileName)
            sourceFile.copyTo(destFile, overwrite = true)
            
            val result = Arguments.createMap().apply {
                putBoolean("success", true)
                putString("path", destFile.absolutePath)
                putDouble("size", destFile.length().toDouble())
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to save file: ${e.message}")
        }
    }
    
    @ReactMethod
    fun deleteFileFromSharel(filePath: String, promise: Promise) {
        try {
            val file = File(filePath)
            
            if (!file.absolutePath.contains("/Sharel/")) {
                promise.reject("INVALID_PATH", "File must be in Sharel folder")
                return
            }
            
            if (!file.exists()) {
                promise.resolve(true)
                return
            }
            
            val deleted = if (file.isDirectory) {
                file.deleteRecursively()
            } else {
                file.delete()
            }
            
            promise.resolve(deleted)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to delete: ${e.message}")
        }
    }
    
    @ReactMethod
    fun getStorageInfo(promise: Promise) {
        try {
            val rootPath = Environment.getExternalStorageDirectory().absolutePath
            val sharelDir = File(rootPath, "Sharel")
            
            val totalSpace = Environment.getExternalStorageDirectory().totalSpace
            val freeSpace = Environment.getExternalStorageDirectory().freeSpace
            val usedSpace = totalSpace - freeSpace
            
            var sharelSize = 0L
            if (sharelDir.exists()) {
                sharelSize = getFolderSize(sharelDir)
            }
            
            val result = Arguments.createMap().apply {
                putDouble("totalSpace", totalSpace.toDouble())
                putDouble("freeSpace", freeSpace.toDouble())
                putDouble("usedSpace", usedSpace.toDouble())
                putDouble("sharelFolderSize", sharelSize.toDouble())
                putString("sharelPath", sharelDir.absolutePath)
                putBoolean("sharelExists", sharelDir.exists())
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to get storage info: ${e.message}")
        }
    }
    
    private fun getFolderSize(dir: File): Long {
        var size = 0L
        dir.listFiles()?.forEach { file ->
            size += if (file.isDirectory) {
                getFolderSize(file)
            } else {
                file.length()
            }
        }
        return size
    }
    
    @ReactMethod
    fun getAndroidVersion(promise: Promise) {
        val result = Arguments.createMap().apply {
            putInt("sdkVersion", Build.VERSION.SDK_INT)
            putString("release", Build.VERSION.RELEASE)
            putBoolean("requiresManageStorage", Build.VERSION.SDK_INT >= Build.VERSION_CODES.R)
        }
        promise.resolve(result)
    }
    
    @ReactMethod
    fun initializeAppDirectories(promise: Promise) {
        try {
            val paths = Arguments.createMap()
            val dataDir = reactApplicationContext.getExternalFilesDir(null)
            if (dataDir != null) {
                if (!dataDir.exists()) dataDir.mkdirs()
                paths.putString("dataPath", dataDir.absolutePath)
                val dataCacheDir = File(dataDir, "cache")
                if (!dataCacheDir.exists()) dataCacheDir.mkdirs()
                paths.putString("dataCachePath", dataCacheDir.absolutePath)
                val dataLogsDir = File(dataCacheDir, "logs")
                if (!dataLogsDir.exists()) dataLogsDir.mkdirs()
                paths.putString("dataLogsPath", dataLogsDir.absolutePath)
                val nomedia = File(dataDir, ".nomedia")
                if (!nomedia.exists()) nomedia.createNewFile()
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                val mediaDirs = reactApplicationContext.externalMediaDirs
                if (mediaDirs.isNotEmpty() && mediaDirs[0] != null) {
                    val mediaDir = mediaDirs[0]
                    if (!mediaDir.exists()) mediaDir.mkdirs()
                    paths.putString("mediaPath", mediaDir.absolutePath)
                    listOf("logs", "downloads", "cache", "temp").forEach { subfolder ->
                        val subDir = File(mediaDir, subfolder)
                        if (!subDir.exists()) subDir.mkdirs()
                    }
                    paths.putString("mediaLogsPath", File(mediaDir, "logs").absolutePath)
                }
            }
            val cacheDir = reactApplicationContext.externalCacheDir
            if (cacheDir != null) {
                if (!cacheDir.exists()) cacheDir.mkdirs()
                paths.putString("cachePath", cacheDir.absolutePath)
                val cacheLogsDir = File(cacheDir, "logs")
                if (!cacheLogsDir.exists()) cacheLogsDir.mkdirs()
                paths.putString("cacheLogsPath", cacheLogsDir.absolutePath)
            }
            val result = Arguments.createMap().apply {
                putBoolean("success", true)
                putMap("paths", paths)
                putString("packageName", reactApplicationContext.packageName)
            }
            promise.resolve(result)
            val event = Arguments.createMap().apply {
                putString("event", "directories_initialized")
                putMap("paths", paths)
            }
            sendEvent("onStorageEvent", event)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to initialize app directories: ${e.message}")
        }
    }
    
    @ReactMethod
    fun getAppDirectories(promise: Promise) {
        try {
            val paths = Arguments.createMap()
            val dataDir = reactApplicationContext.getExternalFilesDir(null)
            if (dataDir != null) {
                paths.putString("dataPath", dataDir.absolutePath)
                paths.putBoolean("dataExists", dataDir.exists())
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                val mediaDirs = reactApplicationContext.externalMediaDirs
                if (mediaDirs.isNotEmpty() && mediaDirs[0] != null) {
                    paths.putString("mediaPath", mediaDirs[0].absolutePath)
                    paths.putBoolean("mediaExists", mediaDirs[0].exists())
                }
            }
            val cacheDir = reactApplicationContext.externalCacheDir
            if (cacheDir != null) {
                paths.putString("cachePath", cacheDir.absolutePath)
                paths.putBoolean("cacheExists", cacheDir.exists())
            }
            paths.putString("packageName", reactApplicationContext.packageName)
            promise.resolve(paths)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to get app directories: ${e.message}")
        }
    }
    
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == REQUEST_CODE_MANAGE_STORAGE) {
            val hasPermission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Environment.isExternalStorageManager()
            } else {
                true
            }
            
            pendingPromise?.resolve(hasPermission)
            pendingPromise = null
            
            val event = Arguments.createMap().apply {
                putString("event", "permission_result")
                putBoolean("granted", hasPermission)
            }
            sendEvent("onStorageEvent", event)
        }
    }
    
    override fun onNewIntent(intent: Intent) {}
    
    @ReactMethod
    fun addListener(eventName: String) {}
    
    @ReactMethod
    fun removeListeners(count: Int) {}
}

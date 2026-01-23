package com.sharel.app

import android.content.Context
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.webkit.MimeTypeMap
import com.facebook.react.bridge.*
import android.util.LruCache
import java.io.*

class FileExplorerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val iconCache = LruCache<String, String>(50) // Cache max 50 icons

    
    override fun getName(): String = "FileExplorerModule"
    
    @ReactMethod
    fun getRootPath(promise: Promise) {
        promise.resolve(Environment.getExternalStorageDirectory().absolutePath)
    }
    
    @ReactMethod
    fun hasStoragePermission(promise: Promise) {
        val hasPermission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            true
        }
        promise.resolve(hasPermission)
    }
    
    @ReactMethod
    fun listFiles(path: String, showHidden: Boolean, promise: Promise) {
        try {
            val dir = File(path)
            if (!dir.exists() || !dir.isDirectory) {
                promise.resolve(Arguments.createArray())
                return
            }
            
            val files = dir.listFiles()?.filter { showHidden || !it.name.startsWith(".") } ?: emptyList()
            val result = Arguments.createArray()
            
            files.forEach { file ->
                result.pushMap(Arguments.createMap().apply {
                    putString("name", file.name)
                    putString("uri", "file://${file.absolutePath}")
                    putString("path", file.absolutePath)
                    putBoolean("isDirectory", file.isDirectory)
                    putDouble("size", file.length().toDouble())
                    putDouble("modificationTime", file.lastModified().toDouble())
                    putBoolean("isHidden", file.isHidden)
                    putBoolean("canRead", file.canRead())
                    putBoolean("canWrite", file.canWrite())
                    putString("extension", file.extension)
                    putString("mimeType", getMimeType(file))
                    putString("parentPath", file.parent ?: "")
                })
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("LIST_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun listFilesWithStats(path: String, showHidden: Boolean, sortBy: String, sortOrder: String, promise: Promise) {
        listFiles(path, showHidden, promise)
    }
    
    @ReactMethod
    fun getStorageStats(promise: Promise) {
        try {
            val stat = StatFs(Environment.getExternalStorageDirectory().path)
            val totalBytes = stat.blockSizeLong * stat.blockCountLong
            val freeBytes = stat.blockSizeLong * stat.availableBlocksLong
            val usedBytes = totalBytes - freeBytes
            
            val result = Arguments.createMap().apply {
                putDouble("totalSpace", totalBytes.toDouble())
                putDouble("freeSpace", freeBytes.toDouble())
                putDouble("usedSpace", usedBytes.toDouble())
                putDouble("usedPercentage", if (totalBytes > 0) (usedBytes.toDouble() / totalBytes * 100) else 0.0)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("STATS_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun getAllFileCounts(promise: Promise) {
        try {
            val root = Environment.getExternalStorageDirectory()
            var images = 0; var videos = 0; var audio = 0; var documents = 0
            var apk = 0; var zip = 0; var downloads = 0; var others = 0
            
            root.walkTopDown().forEach { file ->
                if (file.isFile) {
                    when (file.extension.lowercase()) {
                        "jpg", "jpeg", "png", "gif", "webp", "bmp" -> images++
                        "mp4", "mkv", "avi", "mov", "webm", "3gp" -> videos++
                        "mp3", "wav", "flac", "aac", "ogg", "m4a" -> audio++
                        "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt" -> documents++
                        "apk" -> apk++
                        "zip", "rar", "7z", "tar", "gz" -> zip++
                        else -> others++
                    }
                }
            }
            
            val result = Arguments.createMap().apply {
                putInt("images", images)
                putInt("videos", videos)
                putInt("audio", audio)
                putInt("documents", documents)
                putInt("apk", apk)
                putInt("zip", zip)
                putInt("downloads", downloads)
                putInt("others", others)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("COUNT_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun getQuickAccessPaths(promise: Promise) {
        val result = Arguments.createMap().apply {
            putString("root", Environment.getExternalStorageDirectory().absolutePath)
            putString("downloads", Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).absolutePath)
            putString("dcim", Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DCIM).absolutePath)
            putString("pictures", Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES).absolutePath)
            putString("music", Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC).absolutePath)
            putString("movies", Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES).absolutePath)
            putString("documents", Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS).absolutePath)
        }
        promise.resolve(result)
    }
    
    @ReactMethod
    fun deleteFile(path: String, promise: Promise) {
        try {
            val file = File(path)
            val deleted = if (file.isDirectory) file.deleteRecursively() else file.delete()
            promise.resolve(Arguments.createMap().apply {
                putBoolean("success", deleted)
                putString("source", path)
            })
        } catch (e: Exception) {
            promise.reject("DELETE_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun copyFile(source: String, destination: String, promise: Promise) {
        try {
            File(source).copyTo(File(destination), overwrite = true)
            promise.resolve(Arguments.createMap().apply {
                putBoolean("success", true)
                putString("source", source)
                putString("destination", destination)
            })
        } catch (e: Exception) {
            promise.reject("COPY_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun moveFile(source: String, destination: String, promise: Promise) {
        try {
            File(source).renameTo(File(destination))
            promise.resolve(Arguments.createMap().apply {
                putBoolean("success", true)
                putString("source", source)
                putString("destination", destination)
            })
        } catch (e: Exception) {
            promise.reject("MOVE_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun renameFile(path: String, newName: String, promise: Promise) {
        try {
            val file = File(path)
            val newFile = File(file.parent, newName)
            val success = file.renameTo(newFile)
            promise.resolve(Arguments.createMap().apply {
                putBoolean("success", success)
                putString("oldPath", path)
                putString("newPath", newFile.absolutePath)
            })
        } catch (e: Exception) {
            promise.reject("RENAME_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun makeDirectory(path: String, promise: Promise) {
        try {
            val dir = File(path)
            promise.resolve(dir.mkdirs())
        } catch (e: Exception) {
            promise.reject("MKDIR_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun readFile(path: String, encoding: String, promise: Promise) {
        try {
            promise.resolve(File(path).readText())
        } catch (e: Exception) {
            promise.reject("READ_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun writeFile(path: String, content: String, promise: Promise) {
        try {
            File(path).writeText(content)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("WRITE_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun appendToFile(path: String, content: String, promise: Promise) {
        try {
            File(path).appendText(content)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("APPEND_ERROR", e.message)
        }
    }
    
    private fun getMimeType(file: File): String {
        val extension = file.extension.lowercase()
        return MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension) ?: "application/octet-stream"
    }
    
    @ReactMethod
    fun addListener(eventName: String) {}
    
    @ReactMethod
    fun removeListeners(count: Int) {}
}

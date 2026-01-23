package com.sharel.app

import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.os.Build
import android.os.Environment
import android.util.Base64
import com.facebook.react.bridge.*
import java.io.ByteArrayOutputStream
import java.io.File

class AppsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    private val iconCache = mutableMapOf<String, String>()
    
    override fun getName(): String = "AppsModule"
    
    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        getAllApps(false, promise)
    }
    
    @ReactMethod
    fun getAllApps(includeSystem: Boolean, promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val apps = pm.getInstalledApplications(PackageManager.GET_META_DATA)
            
            val result = Arguments.createArray()
            val sevenDaysAgo = System.currentTimeMillis() - (7 * 24 * 60 * 60 * 1000L)
            
            apps.filter { app ->
                includeSystem || (app.flags and ApplicationInfo.FLAG_SYSTEM) == 0
            }.forEach { app ->
                try {
                    val packageInfo = pm.getPackageInfo(app.packageName, 0)
                    val isNew = packageInfo.firstInstallTime > sevenDaysAgo
                    
                    result.pushMap(Arguments.createMap().apply {
                        putString("id", app.packageName)
                        putString("packageName", app.packageName)
                        putString("appName", pm.getApplicationLabel(app).toString())
                        putString("versionName", packageInfo.versionName ?: "")
                        putDouble("size", File(app.sourceDir).length().toDouble())
                        putDouble("firstInstallTime", packageInfo.firstInstallTime.toDouble())
                        putDouble("lastUpdateTime", packageInfo.lastUpdateTime.toDouble())
                        putString("sourceDir", app.sourceDir)
                        putBoolean("isSystemApp", (app.flags and ApplicationInfo.FLAG_SYSTEM) != 0)
                        putBoolean("isNew", isNew)
                        putBoolean("isInstalled", true)
                    })
                } catch (e: Exception) {
                    // Skip problematic apps
                }
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("APPS_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun getAppsCount(promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val apps = pm.getInstalledApplications(0)
            val userApps = apps.filter { (it.flags and ApplicationInfo.FLAG_SYSTEM) == 0 }
            promise.resolve(userApps.size)
        } catch (e: Exception) {
            promise.reject("COUNT_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun getAppIcon(packageName: String, size: Int, promise: Promise) {
        try {
            val cacheKey = "${packageName}_${size}"
            iconCache[cacheKey]?.let {
                promise.resolve(it)
                return
            }
            
            val pm = reactApplicationContext.packageManager
            val drawable = pm.getApplicationIcon(packageName)
            val bitmap = drawableToBitmap(drawable, size)
            val base64 = bitmapToBase64(bitmap)
            
            iconCache[cacheKey] = base64
            promise.resolve(base64)
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }
    
    @ReactMethod
    fun getAppIconsBatch(packageNames: ReadableArray, size: Int, promise: Promise) {
        try {
            val result = Arguments.createMap()
            val pm = reactApplicationContext.packageManager
            
            for (i in 0 until packageNames.size()) {
                val packageName = packageNames.getString(i) ?: continue
                try {
                    val drawable = pm.getApplicationIcon(packageName)
                    val bitmap = drawableToBitmap(drawable, size)
                    result.putString(packageName, bitmapToBase64(bitmap))
                } catch (e: Exception) {
                    // Skip failed icons
                }
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ICONS_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun getApkFiles(promise: Promise) {
        try {
            val result = Arguments.createArray()
            val downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            
            downloadDir.walkTopDown().filter { it.extension.lowercase() == "apk" }.forEach { file ->
                result.pushMap(Arguments.createMap().apply {
                    putString("id", file.absolutePath)
                    putString("name", file.nameWithoutExtension)
                    putString("filename", file.name)
                    putString("path", file.absolutePath)
                    putString("uri", "file://${file.absolutePath}")
                    putDouble("size", file.length().toDouble())
                    putDouble("lastModified", file.lastModified().toDouble())
                    putString("mimeType", "application/vnd.android.package-archive")
                    putBoolean("isInstalled", false)
                    putString("type", "apk")
                })
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("APK_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun getRecentlyInstalledApps(days: Int, promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val apps = pm.getInstalledApplications(0)
            val cutoff = System.currentTimeMillis() - (days * 24 * 60 * 60 * 1000L)
            
            val result = Arguments.createArray()
            
            apps.filter { (it.flags and ApplicationInfo.FLAG_SYSTEM) == 0 }.forEach { app ->
                try {
                    val packageInfo = pm.getPackageInfo(app.packageName, 0)
                    if (packageInfo.firstInstallTime > cutoff) {
                        result.pushMap(Arguments.createMap().apply {
                            putString("id", app.packageName)
                            putString("packageName", app.packageName)
                            putString("appName", pm.getApplicationLabel(app).toString())
                            putString("versionName", packageInfo.versionName ?: "")
                            putDouble("size", File(app.sourceDir).length().toDouble())
                            putDouble("firstInstallTime", packageInfo.firstInstallTime.toDouble())
                            putString("sourceDir", app.sourceDir)
                            putBoolean("isSystemApp", false)
                            putBoolean("isNew", true)
                            putBoolean("isInstalled", true)
                        })
                    }
                } catch (e: Exception) {}
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("RECENT_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun getAppInfo(packageName: String, promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val appInfo = pm.getApplicationInfo(packageName, 0)
            val packageInfo = pm.getPackageInfo(packageName, 0)
            
            val result = Arguments.createMap().apply {
                putString("packageName", packageName)
                putString("appName", pm.getApplicationLabel(appInfo).toString())
                putString("versionName", packageInfo.versionName ?: "")
                putInt("versionCode", if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) packageInfo.longVersionCode.toInt() else @Suppress("DEPRECATION") packageInfo.versionCode)
                putDouble("firstInstallTime", packageInfo.firstInstallTime.toDouble())
                putDouble("lastUpdateTime", packageInfo.lastUpdateTime.toDouble())
                putDouble("size", File(appInfo.sourceDir).length().toDouble())
                putString("sourceDir", appInfo.sourceDir)
                putBoolean("isSystemApp", (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0)
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }
    
    @ReactMethod
    fun clearIconCache(promise: Promise) {
        iconCache.clear()
        promise.resolve(true)
    }
    
    private fun drawableToBitmap(drawable: Drawable, size: Int): Bitmap {
        if (drawable is BitmapDrawable && drawable.bitmap != null) {
            return Bitmap.createScaledBitmap(drawable.bitmap, size, size, true)
        }
        
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        drawable.setBounds(0, 0, size, size)
        drawable.draw(canvas)
        return bitmap
    }
    
    private fun bitmapToBase64(bitmap: Bitmap): String {
        val outputStream = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream)
        return "data:image/png;base64," + Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP)
    }
    
    @ReactMethod
    fun addListener(eventName: String) {}
    
    @ReactMethod
    fun removeListeners(count: Int) {}
}

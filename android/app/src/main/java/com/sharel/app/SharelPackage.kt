package com.sharel.app

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class SharelPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(
            HotspotModule(reactContext),
            HttpServerModule(reactContext),
            WifiDirectModule(reactContext),
            FileExplorerModule(reactContext),
            MediaGalleryModule(reactContext),
            ContactsModule(reactContext),
            AppsModule(reactContext),
            StorageModule(reactContext),
            LogModule(reactContext)
        )
    }
    @ReactMethod
    fun logPerformance(tag: String, operation: String, durationMs: Long, success: Boolean, details: String?, promise: Promise) {
        try {
            val timestamp = SimpleDateFormat("HH:mm:ss.SSS", Locale.US).format(Date())
            val level = if (success) "INFO" else "WARN"
            val logLine = "[$timestamp] [$level] [$tag] $operation completed in ${durationMs}ms | success=$success | details=${details ?: "none"}"
            File(logFilePath).appendText(logLine + "
")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("LOG_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun logCrash(tag: String, crashMessage: String, stackTrace: String?, promise: Promise) {
        try {
            val timestamp = SimpleDateFormat("HH:mm:ss.SSS", Locale.US).format(Date())
            val logLine = "[$timestamp] [ERROR] [$tag] 💥 CRASH: $crashMessage
Stack: ${stackTrace ?: "N/A"}"
            File(logFilePath).appendText(logLine + "
")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CRASH_LOG_ERROR", e.message)
        }
    }

    
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}

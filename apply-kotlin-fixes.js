#!/usr/bin/env node
/**
 * Script pour appliquer tous les fixes Kotlin à withHotspotNative.js
 * Remplace les 4 modules critiques + améliore LogModule
 */

const fs = require('fs');
const path = require('path');

const pluginPath = path.join(__dirname, 'plugins', 'withHotspotNative.js');
let content = fs.readFileSync(pluginPath, 'utf-8');

console.log('[KOTLIN_APPLY] Starting fixes...');
console.log('[KOTLIN_APPLY] File size:', (content.length / 1024).toFixed(2), 'KB');

// ============ FIX 1: HotspotModule ============
console.log('[HOTSPOT] Fixing HotspotModule...');

const HOTSPOT_FIXED = `const HOTSPOT_MODULE_KT = \`package com.sharel.app

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiManager
import android.net.wifi.WifiNetworkSpecifier
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.annotation.RequiresApi
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.net.Inet4Address
import java.net.NetworkInterface
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

class HotspotModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    companion object {
        private const val TAG = "HotspotModule"
        private const val CONNECTION_TIMEOUT_SECONDS = 15L
    }
    
    private var hotspotReservation: WifiManager.LocalOnlyHotspotReservation? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var connectedNetwork: Network? = null
    
    override fun getName(): String = "HotspotModule"
    
    private fun sendEvent(eventName: String, params: WritableMap?) {
        try {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send event \$eventName", e)
        }
    }
    
    @ReactMethod
    fun connectToWifi(ssid: String, password: String, ipAddress: String, port: Int, promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            promise.reject("ERROR", "WiFi connection requires Android 10 or higher")
            return
        }
        
        Log.d(TAG, "Attempting WiFi connection: SSID=\$ssid, IP=\$ipAddress:\$port")
        
        Thread {
            try {
                connectToWifiAndroid10Plus(ssid, password, ipAddress, port, promise)
            } catch (e: Exception) {
                Log.e(TAG, "Connection error", e)
                mainHandler.post {
                    promise.reject("WIFI_ERROR", "Failed to connect: \${e.message}")
                }
            }
        }.start()
    }
    
    @RequiresApi(Build.VERSION_CODES.Q)
    private fun connectToWifiAndroid10Plus(ssid: String, password: String, ipAddress: String, port: Int, promise: Promise) {
        val connectivityManager = reactApplicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        var isConnected = false
        var hasTimedOut = false
        
        networkCallback?.let {
            try { connectivityManager.unregisterNetworkCallback(it) } catch (e: Exception) {}
        }
        
        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                Log.d(TAG, "Network available: \$network")
                connectedNetwork = network
                
                try {
                    connectivityManager.bindProcessToNetwork(network)
                    Log.d(TAG, "Process bound to network")
                    
                    Thread.sleep(2000)
                    
                    val pingUrl = URL("http://\$ipAddress:\$port/ping")
                    val connection = network.openConnection(pingUrl) as HttpURLConnection
                    connection.requestMethod = "GET"
                    connection.connectTimeout = 5000
                    connection.readTimeout = 5000
                    
                    try {
                        val responseCode = connection.responseCode
                        Log.d(TAG, "Ping response: \$responseCode")
                        
                        mainHandler.post {
                            if (responseCode in 200..299) {
                                isConnected = true
                                val result = Arguments.createMap().apply {
                                    putBoolean("connected", true)
                                    putString("ssid", ssid)
                                    putString("ipAddress", ipAddress)
                                    putInt("port", port)
                                }
                                promise.resolve(result)
                                
                                val event = Arguments.createMap().apply {
                                    putString("event", "connected")
                                    putString("ssid", ssid)
                                }
                                sendEvent("onWifiConnectionChanged", event)
                            } else {
                                mainHandler.post {
                                    promise.reject("PING_ERROR", "Server responded with: \$responseCode")
                                }
                            }
                        }
                    } finally {
                        connection.disconnect()
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error in ping/connection", e)
                    mainHandler.post {
                        if (!isConnected && !hasTimedOut) {
                            isConnected = true
                            val result = Arguments.createMap().apply {
                                putBoolean("connected", true)
                                putString("ssid", ssid)
                                putString("ipAddress", ipAddress)
                                putInt("port", port)
                                putString("warning", "Connected but server unreachable: \${e.message}")
                            }
                            promise.resolve(result)
                            
                            val event = Arguments.createMap().apply {
                                putString("event", "connected")
                                putString("ssid", ssid)
                            }
                            sendEvent("onWifiConnectionChanged", event)
                        }
                    }
                }
            }
            
            override fun onUnavailable() {
                Log.e(TAG, "WiFi network unavailable")
                mainHandler.post {
                    if (!isConnected) {
                        hasTimedOut = true
                        promise.reject("WIFI_UNAVAILABLE", "WiFi network not available. Ensure sender hotspot is active.")
                    }
                }
            }
            
            override fun onLost(network: Network) {
                Log.d(TAG, "Network lost")
                connectedNetwork = null
                val event = Arguments.createMap().apply {
                    putString("event", "disconnected")
                }
                sendEvent("onWifiConnectionChanged", event)
            }
        }
        
        val specifier = WifiNetworkSpecifier.Builder()
            .setSsid(ssid)
            .setWpa2Passphrase(password)
            .build()
        
        val request = NetworkRequest.Builder()
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
            .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .setNetworkSpecifier(specifier)
            .build()
        
        try {
            connectivityManager.requestNetwork(request, networkCallback!!, (CONNECTION_TIMEOUT_SECONDS * 1000).toInt())
            Log.d(TAG, "Network request sent")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to request network", e)
            promise.reject("REQUEST_FAILED", "Failed to request network: \${e.message}")
        }
    }
    
    @ReactMethod
    fun disconnectFromWifi(promise: Promise) {
        try {
            val connectivityManager = reactApplicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            
            networkCallback?.let {
                try { connectivityManager.unregisterNetworkCallback(it) } catch (e: Exception) {}
            }
            networkCallback = null
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                connectivityManager.bindProcessToNetwork(null)
            }
            
            connectedNetwork = null
            Log.d(TAG, "Disconnected from WiFi")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to disconnect", e)
            promise.reject("ERROR", "Failed to disconnect: \${e.message}")
        }
    }
    
    @ReactMethod
    fun startLocalHotspot(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            promise.reject("ERROR", "LocalOnlyHotspot requires Android 8.0 or higher")
            return
        }
        
        val wifiManager = reactApplicationContext.applicationContext
            .getSystemService(Context.WIFI_SERVICE) as WifiManager
        
        try {
            startHotspotInternal(wifiManager, promise)
        } catch (e: SecurityException) {
            Log.e(TAG, "Permission error", e)
            promise.reject("PERMISSION_ERROR", "Location permission required")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start hotspot", e)
            promise.reject("ERROR", "Failed to start hotspot: \${e.message}")
        }
    }
    
    @RequiresApi(Build.VERSION_CODES.O)
    private fun startHotspotInternal(wifiManager: WifiManager, promise: Promise) {
        wifiManager.startLocalOnlyHotspot(object : WifiManager.LocalOnlyHotspotCallback() {
            override fun onStarted(reservation: WifiManager.LocalOnlyHotspotReservation?) {
                hotspotReservation = reservation
                
                val result = Arguments.createMap().apply {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        val softApConfig = reservation?.softApConfiguration
                        putString("ssid", softApConfig?.ssid ?: "Sharel_Hotspot")
                        putString("passphrase", softApConfig?.passphrase ?: "")
                    } else {
                        putString("ssid", "Sharel_Hotspot")
                    }
                    putBoolean("isStarted", true)
                }
                promise.resolve(result)
                
                val event = Arguments.createMap().apply {
                    putString("event", "hotspotStarted")
                    putString("ssid", result.getString("ssid"))
                }
                sendEvent("onHotspotStateChanged", event)
                
                Log.d(TAG, "Hotspot started successfully")
            }
            
            override fun onStopped() {
                hotspotReservation = null
                val event = Arguments.createMap().apply {
                    putString("event", "hotspotStopped")
                }
                sendEvent("onHotspotStateChanged", event)
                Log.d(TAG, "Hotspot stopped")
            }
            
            override fun onFailed(reason: Int) {
                val errorMsg = when (reason) {
                    ERROR_GENERIC -> "Generic error"
                    ERROR_NO_CHANNEL -> "No channel available"
                    else -> "Unknown error: \$reason"
                }
                Log.e(TAG, "Hotspot start failed: \$errorMsg")
                promise.reject("HOTSPOT_ERROR", errorMsg)
            }
        }, null, null)
    }
    
    @ReactMethod
    fun stopLocalHotspot(promise: Promise) {
        try {
            hotspotReservation?.close()
            hotspotReservation = null
            promise.resolve(true)
            Log.d(TAG, "Hotspot stop requested")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop hotspot", e)
            promise.reject("ERROR", "Failed to stop hotspot: \${e.message}")
        }
    }
    
    @ReactMethod
    fun getHostAddress(promise: Promise) {
        try {
            var hostAddress = "192.168.43.1"
            
            for (networkInterface in NetworkInterface.getNetworkInterfaces().asSequence()) {
                if (!networkInterface.isLoopback && networkInterface.isUp) {
                    for (address in networkInterface.inetAddresses.asSequence()) {
                        if (!address.isLoopbackAddress && address is Inet4Address) {
                            val addr = address.hostAddress
                            if (addr != null && addr.startsWith("192.168.")) {
                                hostAddress = addr
                                break
                            }
                        }
                    }
                }
            }
            
            promise.resolve(hostAddress)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting host address", e)
            promise.resolve("192.168.43.1")
        }
    }
    
    @ReactMethod
    fun addListener(eventName: String) {}
    
    @ReactMethod
    fun removeListeners(count: Int) {}
}
``;`;

// Find old HOTSPOT_MODULE_KT definition and replace
const hotspotStart = content.indexOf('const HOTSPOT_MODULE_KT = `package com.sharel.app');
const hotspotEnd = content.indexOf('\`;\n\nconst HTTP_SERVER_MODULE_KT', hotspotStart);

if (hotspotStart !== -1 && hotspotEnd !== -1) {
    content = content.substring(0, hotspotStart) + HOTSPOT_FIXED + content.substring(hotspotEnd + 3);
    console.log('[HOTSPOT] ✅ Replaced');
} else {
    console.error('[HOTSPOT] ❌ Could not find boundaries');
    process.exit(1);
}

console.log('[KOTLIN_APPLY] File size after HOTSPOT:', (content.length / 1024).toFixed(2), 'KB');

// ============ FIX 2: Improved LogModule ============
console.log('[LOG] Fixing LogModule with better formatting and timing...');

const LOG_FIXED = `const LOG_MODULE_KT = \`package com.sharel.app

import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.*
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.ConcurrentLinkedQueue

class LogModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    companion object {
        private const val TAG = "SharelLogger"
        private const val MAX_LOG_FILE_SIZE = 5 * 1024 * 1024L
        private const val MAX_RECENT_LOGS = 500
        private const val LOG_FILE_NAME = "sharel_log.txt"
        private const val CRASH_LOG_FILE_NAME = "crash_log.txt"
        
        @Volatile
        private var instance: SharelLogger? = null
        
        fun getInstance(context: Context): SharelLogger {
            return instance ?: synchronized(this) {
                instance ?: SharelLogger(context.applicationContext).also { instance = it }
            }
        }
        
        fun initializeGlobal(context: Context) {
            getInstance(context).initialize()
        }
    }
    
    private val logger: SharelLogger by lazy { getInstance(reactApplicationContext) }
    
    override fun getName(): String = "LogModule"
    
    @ReactMethod
    fun initialize(promise: Promise) {
        try {
            logger.initialize()
            val result = Arguments.createMap().apply {
                putBoolean("success", true)
                putString("logPath", logger.getLogFilePath())
                putString("logDirectory", logger.getLogDirectory())
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("INIT_ERROR", "Failed to initialize logger: \${e.message}")
        }
    }
    
    @ReactMethod
    fun logPerformance(tag: String, operation: String, durationMs: Long, success: Boolean, details: String?, promise: Promise) {
        try {
            val level = if (success) LogLevel.INFO else LogLevel.WARN
            val message = "\$operation completed in \${durationMs}ms | success=\$success"
            val data = "op=\$operation | duration=\${durationMs}ms | success=\$success | details=\${details ?: "none"}"
            logger.log(level, tag, message, data)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("LOG_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun logCrash(tag: String, crashMessage: String, stackTrace: String?, promise: Promise) {
        try {
            val data = "crash=\$crashMessage\\nstack=\${stackTrace ?: "N/A"}"
            logger.log(LogLevel.ERROR, tag, "💥 CRASH DETECTED", data)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CRASH_LOG_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun log(level: String, tag: String, message: String, data: String?, promise: Promise) {
        try {
            val logLevel = when (level.lowercase()) {
                "debug" -> LogLevel.DEBUG
                "info" -> LogLevel.INFO
                "warn" -> LogLevel.WARN
                "error" -> LogLevel.ERROR
                else -> LogLevel.INFO
            }
            logger.log(logLevel, tag, message, data)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("LOG_ERROR", "Failed to write log: \${e.message}")
        }
    }
    
    @ReactMethod fun debug(tag: String, message: String, data: String?) { logger.debug(tag, message, data) }
    @ReactMethod fun info(tag: String, message: String, data: String?) { logger.info(tag, message, data) }
    @ReactMethod fun warn(tag: String, message: String, data: String?) { logger.warn(tag, message, data) }
    @ReactMethod fun error(tag: String, message: String, data: String?) { logger.error(tag, message, data) }
    
    @ReactMethod
    fun flush(promise: Promise) {
        try { logger.flush(); promise.resolve(true) }
        catch (e: Exception) { promise.reject("FLUSH_ERROR", "Failed to flush: \${e.message}") }
    }
    
    @ReactMethod
    fun getRecentLogs(limit: Int, promise: Promise) {
        try {
            val logs = logger.getRecentLogs(limit)
            val result = Arguments.createArray()
            logs.forEach { entry ->
                val logMap = Arguments.createMap().apply {
                    putString("timestamp", entry.timestamp)
                    putString("level", entry.level.name.lowercase())
                    putString("tag", entry.tag)
                    putString("message", entry.message)
                    entry.data?.let { putString("data", it) }
                }
                result.pushMap(logMap)
            }
            promise.resolve(result)
        } catch (e: Exception) { promise.reject("READ_ERROR", "Failed to get logs: \${e.message}") }
    }
    
    @ReactMethod fun getLogFilePath(promise: Promise) { promise.resolve(logger.getLogFilePath()) }
    @ReactMethod fun getLogFileContent(promise: Promise) { try { promise.resolve(logger.readLogFile()) } catch (e: Exception) { promise.reject("READ_ERROR", e.message) } }
    @ReactMethod fun clearLogs(promise: Promise) { try { logger.clear(); promise.resolve(true) } catch (e: Exception) { promise.reject("CLEAR_ERROR", e.message) } }
    
    @ReactMethod
    fun getLogInfo(promise: Promise) {
        try {
            val result = Arguments.createMap().apply {
                putString("logPath", logger.getLogFilePath())
                putString("logDirectory", logger.getLogDirectory())
                putDouble("logFileSize", logger.getLogFileSize().toDouble())
                putInt("recentLogsCount", logger.getRecentLogsCount())
                putBoolean("isInitialized", logger.isInitialized())
            }
            promise.resolve(result)
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }
    
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
    
    enum class LogLevel { DEBUG, INFO, WARN, ERROR }
    data class LogEntry(val timestamp: String, val level: LogLevel, val tag: String, val message: String, val data: String? = null)
    
    class SharelLogger(private val context: Context) {
        private var logDirectory: String = ""
        private var logFilePath: String = ""
        private var crashLogPath: String = ""
        private var initialized: Boolean = false
        private val recentLogs = ConcurrentLinkedQueue<LogEntry>()
        private val writeQueue = ConcurrentLinkedQueue<String>()
        private var handlerThread: HandlerThread? = null
        private var writeHandler: Handler? = null
        private var writer: BufferedWriter? = null
        private val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US)
        private var previousHandler: Thread.UncaughtExceptionHandler? = null
        
        fun initialize() {
            if (initialized) return
            synchronized(this) {
                if (initialized) return
                try {
                    setupLogDirectory()
                    setupHandlerThread()
                    setupUncaughtExceptionHandler()
                    initialized = true
                    info(TAG, "=== Sharel Logger Initialized ===")
                    info(TAG, "Log directory: \$logDirectory")
                    info(TAG, "Android SDK: \${Build.VERSION.SDK_INT}, Device: \${Build.MANUFACTURER} \${Build.MODEL}")
                } catch (e: Exception) { Log.e(TAG, "Failed to initialize logger", e) }
            }
        }
        
        private fun setupLogDirectory() {
            logDirectory = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                val mediaDirs = context.externalMediaDirs
                if (mediaDirs.isNotEmpty() && mediaDirs[0] != null) File(mediaDirs[0], "logs").apply { mkdirs() }.absolutePath
                else File(context.getExternalFilesDir(null), "logs").apply { mkdirs() }.absolutePath
            } else { File(context.getExternalFilesDir(null), "logs").apply { mkdirs() }.absolutePath }
            logFilePath = File(logDirectory, LOG_FILE_NAME).absolutePath
            crashLogPath = File(logDirectory, CRASH_LOG_FILE_NAME).absolutePath
            File(logDirectory).mkdirs()
            rotateLogIfNeeded()
        }
        
        private fun setupHandlerThread() {
            handlerThread = HandlerThread("SharelLoggerThread").apply { start() }
            writeHandler = Handler(handlerThread!!.looper)
            try { writer = BufferedWriter(FileWriter(logFilePath, true), 8192) }
            catch (e: Exception) { Log.e(TAG, "Failed to create log writer", e) }
        }
        
        private fun setupUncaughtExceptionHandler() {
            previousHandler = Thread.getDefaultUncaughtExceptionHandler()
            Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
                try {
                    val crashTime = dateFormat.format(Date())
                    val crashReport = "=== FATAL CRASH REPORT ===\\nTimestamp: \$crashTime\\nThread: \${thread.name}\\nException: \${throwable.javaClass.name}\\nMessage: \${throwable.message}\\nStack: \${Log.getStackTraceString(throwable)}\\nDevice: \${Build.MANUFACTURER} \${Build.MODEL}\\n=== END CRASH ===\\n"
                    error(TAG, "FATAL CRASH: \${throwable.message}")
                    try { File(crashLogPath).appendText(crashReport) } catch (e: Exception) { Log.e(TAG, "Failed to write crash log", e) }
                    flushSync()
                } catch (e: Exception) { Log.e(TAG, "Error in crash handler", e) }
                previousHandler?.uncaughtException(thread, throwable)
            }
        }
        
        fun log(level: LogLevel, tag: String, message: String, data: String? = null) {
            val entry = LogEntry(dateFormat.format(Date()), level, tag, message, data)
            recentLogs.add(entry)
            while (recentLogs.size > MAX_RECENT_LOGS) recentLogs.poll()
            when (level) { LogLevel.DEBUG -> Log.d(tag, message); LogLevel.INFO -> Log.i(tag, message); LogLevel.WARN -> Log.w(tag, message); LogLevel.ERROR -> Log.e(tag, message) }
            writeQueue.add(formatLogLine(entry))
            scheduleWrite()
        }
        
        private fun formatLogLine(entry: LogEntry): String = "[\${entry.timestamp}] [\${entry.level.name}] [\${entry.tag}] \${entry.message}\${entry.data?.let { " | \$it" } ?: ""}\\n"
        private fun scheduleWrite() { writeHandler?.post { try { while (writeQueue.isNotEmpty()) { writer?.write(writeQueue.poll() ?: break) }; writer?.flush(); checkAndRotateIfNeeded() } catch (e: Exception) { Log.e(TAG, "Error writing log", e) } } }
        private fun checkAndRotateIfNeeded() { try { val f = File(logFilePath); if (f.exists() && f.length() > MAX_LOG_FILE_SIZE) { writer?.close(); File("\${logFilePath}.old").delete(); f.renameTo(File("\${logFilePath}.old")); writer = BufferedWriter(FileWriter(logFilePath, true), 8192); Log.i(TAG, "Log rotated") } } catch (e: Exception) { Log.e(TAG, "Rotation failed", e) } }
        fun debug(tag: String, message: String, data: String? = null) = log(LogLevel.DEBUG, tag, message, data)
        fun info(tag: String, message: String, data: String? = null) = log(LogLevel.INFO, tag, message, data)
        fun warn(tag: String, message: String, data: String? = null) = log(LogLevel.WARN, tag, message, data)
        fun error(tag: String, message: String, data: String? = null) = log(LogLevel.ERROR, tag, message, data)
        fun flush() { writeHandler?.post { try { while (writeQueue.isNotEmpty()) writer?.write(writeQueue.poll() ?: break); writer?.flush() } catch (e: Exception) { Log.e(TAG, "Error flushing", e) } } }
        private fun flushSync() { try { while (writeQueue.isNotEmpty()) writer?.write(writeQueue.poll() ?: break); writer?.flush() } catch (e: Exception) { Log.e(TAG, "Error syncing", e) } }
        fun getRecentLogs(limit: Int = MAX_RECENT_LOGS): List<LogEntry> = recentLogs.toList().takeLast(limit)
        fun getLogFilePath(): String = logFilePath
        fun getLogDirectory(): String = logDirectory
        fun getLogFileSize(): Long = try { File(logFilePath).length() } catch (e: Exception) { 0L }
        fun getRecentLogsCount(): Int = recentLogs.size
        fun isInitialized(): Boolean = initialized
        fun readLogFile(): String = try { File(logFilePath).readText() } catch (e: Exception) { "" }
        fun clear() { recentLogs.clear(); writeQueue.clear(); try { File(logFilePath).writeText(""); info(TAG, "Logs cleared") } catch (e: Exception) { Log.e(TAG, "Failed to clear", e) } }
        private fun rotateLogIfNeeded() { try { val f = File(logFilePath); if (f.exists() && f.length() > MAX_LOG_FILE_SIZE) { File("\${logFilePath}.old").delete(); f.renameTo(File("\${logFilePath}.old")) } } catch (e: Exception) { Log.e(TAG, "Failed to rotate", e) } }
    }
}
\``;`;

// Find old LOG_MODULE_KT definition and replace
const logStart = content.indexOf('const LOG_MODULE_KT = `package com.sharel.app');
const logEnd = content.indexOf('\`;\n\nconst SHAREL_PACKAGE_KT', logStart);

if (logStart !== -1 && logEnd !== -1) {
    content = content.substring(0, logStart) + LOG_FIXED + content.substring(logEnd + 3);
    console.log('[LOG] ✅ Replaced with improved logging (timing + crashes)');
} else {
    console.error('[LOG] ❌ Could not find boundaries');
    process.exit(1);
}

console.log('[KOTLIN_APPLY] File size after LOG:', (content.length / 1024).toFixed(2), 'KB');

// Write back
fs.writeFileSync(pluginPath, content);
console.log('[KOTLIN_APPLY] ✅ All fixes applied successfully!');
console.log('[KOTLIN_APPLY] Final file size:', (content.length / 1024).toFixed(2), 'KB');


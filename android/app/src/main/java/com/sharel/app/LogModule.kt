package com.sharel.app

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
            promise.reject("INIT_ERROR", "Failed to initialize logger: ${e.message}")
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
            promise.reject("LOG_ERROR", "Failed to write log: ${e.message}")
        }
    }
    
    @ReactMethod fun debug(tag: String, message: String, data: String?) { logger.debug(tag, message, data) }
    @ReactMethod fun info(tag: String, message: String, data: String?) { logger.info(tag, message, data) }
    @ReactMethod fun warn(tag: String, message: String, data: String?) { logger.warn(tag, message, data) }
    @ReactMethod fun error(tag: String, message: String, data: String?) { logger.error(tag, message, data) }
    
    @ReactMethod
    fun flush(promise: Promise) {
        try { logger.flush(); promise.resolve(true) }
        catch (e: Exception) { promise.reject("FLUSH_ERROR", "Failed to flush: ${e.message}") }
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
        } catch (e: Exception) { promise.reject("READ_ERROR", "Failed to get logs: ${e.message}") }
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
                    info(TAG, "Log directory: $logDirectory")
                    info(TAG, "Android SDK: ${Build.VERSION.SDK_INT}, Device: ${Build.MANUFACTURER} ${Build.MODEL}")
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
                    val crashReport = "=== FATAL CRASH REPORT ===\nTimestamp: $crashTime\nThread: ${thread.name}\nException: ${throwable.javaClass.name}\nMessage: ${throwable.message}\nStack: ${Log.getStackTraceString(throwable)}\nDevice: ${Build.MANUFACTURER} ${Build.MODEL}\n=== END CRASH ===\n"
                    error(TAG, "FATAL CRASH: ${throwable.message}")
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
        
        private fun formatLogLine(entry: LogEntry): String = "[${entry.timestamp}] [${entry.level.name}] [${entry.tag}] ${entry.message}${entry.data?.let { " | $it" } ?: ""}\n"
        private fun scheduleWrite() { writeHandler?.post { try { while (writeQueue.isNotEmpty()) { writer?.write(writeQueue.poll() ?: break) }; writer?.flush(); checkAndRotateIfNeeded() } catch (e: Exception) { Log.e(TAG, "Error writing log", e) } } }
        private fun checkAndRotateIfNeeded() { try { val f = File(logFilePath); if (f.exists() && f.length() > MAX_LOG_FILE_SIZE) { writer?.close(); File("${logFilePath}.old").delete(); f.renameTo(File("${logFilePath}.old")); writer = BufferedWriter(FileWriter(logFilePath, true), 8192); Log.i(TAG, "Log rotated") } } catch (e: Exception) { Log.e(TAG, "Rotation failed", e) } }
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
        private fun rotateLogIfNeeded() { try { val f = File(logFilePath); if (f.exists() && f.length() > MAX_LOG_FILE_SIZE) { File("${logFilePath}.old").delete(); f.renameTo(File("${logFilePath}.old")) } } catch (e: Exception) { Log.e(TAG, "Failed to rotate", e) } }
    }
}

package com.sharel.app

import android.content.ContentValues
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import fi.iki.elonen.NanoHTTPD
import java.io.*

class HttpServerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    private var server: SharelHttpServer? = null
    
    override fun getName(): String = "HttpServerModule"
    
    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
    
    @ReactMethod
    fun startServer(port: Int, promise: Promise) {
        try {
            if (server != null && server!!.isAlive) {
                android.util.Log.d("SharelHttpServer", "Server already running on port $port")
                promise.resolve(true)
                return
            }
            
            android.util.Log.d("SharelHttpServer", "Starting server on port $port...")
            server = SharelHttpServer(port, this)
            server?.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false)
            
            // Verify server is actually running
            val isRunning = server?.isAlive == true
            android.util.Log.d("SharelHttpServer", "Server started: $isRunning, port: $port")
            
            if (isRunning) {
                // Log all available interfaces for debugging
                try {
                    val interfaces = java.net.NetworkInterface.getNetworkInterfaces()
                    while (interfaces?.hasMoreElements() == true) {
                        val ni = interfaces.nextElement()
                        val addresses = ni.inetAddresses
                        while (addresses.hasMoreElements()) {
                            val addr = addresses.nextElement()
                            if (!addr.isLoopbackAddress && addr is java.net.Inet4Address) {
                                android.util.Log.d("SharelHttpServer", "Interface: ${ni.name}, IP: ${addr.hostAddress}")
                            }
                        }
                    }
                } catch (e: Exception) {
                    android.util.Log.e("SharelHttpServer", "Error listing interfaces: ${e.message}")
                }
                
                promise.resolve(true)
            } else {
                promise.reject("SERVER_ERROR", "Server failed to start - not alive after start()")
            }
        } catch (e: Exception) {
            android.util.Log.e("SharelHttpServer", "Failed to start server: ${e.message}", e)
            promise.reject("SERVER_ERROR", "Failed to start server: ${e.message}")
        }
    }
    
    @ReactMethod
    fun stopServer(promise: Promise) {
        try {
            server?.stop()
            server = null
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SERVER_ERROR", "Failed to stop server: ${e.message}")
        }
    }
    
    @ReactMethod
    fun isServerRunning(promise: Promise) {
        promise.resolve(server?.isAlive == true)
    }
    
    @ReactMethod
    fun getDownloadDirectory(promise: Promise) {
        val downloadPath = getSharelDownloadDirectory()
        promise.resolve(downloadPath)
    }
    
    private fun getSharelDownloadDirectory(): String {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            reactApplicationContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)?.absolutePath
                ?: reactApplicationContext.filesDir.absolutePath
        } else {
            val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            val sharelDir = File(downloadsDir, "Sharel")
            if (!sharelDir.exists()) {
                sharelDir.mkdirs()
            }
            sharelDir.absolutePath
        }
    }
    
    fun saveFileWithMediaStore(fileName: String, inputStream: InputStream, fileSize: Long): String? {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val resolver = reactApplicationContext.contentResolver
            val contentValues = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Sharel")
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
            uri?.let {
                resolver.openOutputStream(it)?.use { outputStream ->
                    inputStream.copyTo(outputStream)
                }
                contentValues.clear()
                contentValues.put(MediaStore.Downloads.IS_PENDING, 0)
                resolver.update(uri, contentValues, null, null)
                return uri.toString()
            }
            return null
        } else {
            val destFile = File(getSharelDownloadDirectory(), fileName)
            FileOutputStream(destFile).use { outputStream ->
                inputStream.copyTo(outputStream)
            }
            return destFile.absolutePath
        }
    }
    
    fun notifyFileReceived(fileName: String, filePath: String, fileSize: Long) {
        val params = Arguments.createMap().apply {
            putString("fileName", fileName)
            putString("filePath", filePath)
            putDouble("fileSize", fileSize.toDouble())
        }
        sendEvent("onFileReceived", params)
    }
    
    fun notifyTransferProgress(fileName: String, progress: Double) {
        val params = Arguments.createMap().apply {
            putString("fileName", fileName)
            putDouble("progress", progress)
        }
        sendEvent("onTransferProgress", params)
    }
    
    fun notifyClientConnected(clientIp: String) {
        val params = Arguments.createMap().apply {
            putString("clientIp", clientIp)
        }
        sendEvent("onClientConnected", params)
    }
    
    @ReactMethod
    fun addListener(eventName: String) {}
    
    @ReactMethod
    fun removeListeners(count: Int) {}
    
    inner class SharelHttpServer(port: Int, private val module: HttpServerModule) : NanoHTTPD(port) {
        
        override fun serve(session: IHTTPSession): Response {
            val uri = session.uri
            val method = session.method
            
            module.notifyClientConnected(session.remoteIpAddress)
            
            return when {
                uri == "/" || uri == "" -> serveHomePage(session.remoteIpAddress)
                
                uri == "/ping" -> newFixedLengthResponse(Response.Status.OK, "application/json", """{"status":"ok","name":"Sharel"}""")
                
                uri == "/join" -> {
                    module.notifyClientConnected(session.remoteIpAddress)
                    newFixedLengthResponse(Response.Status.OK, "application/json", """{"status":"ok","joined":true,"message":"Welcome to the room"}""")
                }
                
                uri == "/info" -> {
                    val info = """{"status":"ready","version":"1.0.0"}"""
                    newFixedLengthResponse(Response.Status.OK, "application/json", info)
                }
                
                method == Method.POST && uri == "/upload" -> handleUpload(session)
                
                method == Method.GET && uri.startsWith("/download/") -> handleDownload(uri.removePrefix("/download/"))
                
                uri == "/files" -> listAvailableFiles()
                
                uri == "/api/download-apk" -> downloadAPK()
                
                else -> newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "Not Found: $uri")
            }
        }
        
        private fun handleUpload(session: IHTTPSession): Response {
            try {
                val files = HashMap<String, String>()
                session.parseBody(files)
                
                val fileName = session.parameters["filename"]?.firstOrNull() 
                    ?: "file_${System.currentTimeMillis()}"
                
                val tmpFilePath = files["file"]
                if (tmpFilePath != null) {
                    val tmpFile = File(tmpFilePath)
                    val fileSize = tmpFile.length()
                    
                    val savedPath = module.saveFileWithMediaStore(
                        fileName, 
                        FileInputStream(tmpFile),
                        fileSize
                    )
                    
                    tmpFile.delete()
                    
                    if (savedPath != null) {
                        module.notifyFileReceived(fileName, savedPath, fileSize)
                        return newFixedLengthResponse(
                            Response.Status.OK, 
                            "application/json", 
                            """{"success":true,"path":"$savedPath"}"""
                        )
                    }
                    
                    return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "Failed to save file")
                }
                
                return newFixedLengthResponse(Response.Status.BAD_REQUEST, "text/plain", "No file provided")
            } catch (e: Exception) {
                return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "Upload failed: ${e.message}")
            }
        }
        
        private fun handleDownload(fileName: String): Response {
            try {
                val downloadDir = module.getSharelDownloadDirectory()
                val file = File(downloadDir, fileName)
                if (!file.exists()) {
                    return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "File not found")
                }
                
                val fis = FileInputStream(file)
                return newFixedLengthResponse(
                    Response.Status.OK,
                    "application/octet-stream",
                    fis,
                    file.length()
                )
            } catch (e: Exception) {
                return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "Download failed: ${e.message}")
            }
        }
        
        private fun listAvailableFiles(): Response {
            val downloadDir = module.getSharelDownloadDirectory()
            val dir = File(downloadDir)
            val files = dir.listFiles()?.map { 
                """{"name":"${it.name}","size":${it.length()}}"""
            }?.joinToString(",") ?: ""
            return newFixedLengthResponse(Response.Status.OK, "application/json", """{"files":[$files]}""")
        }
        
        private fun downloadAPK(): Response {
            try {
                val downloadDir = module.getSharelDownloadDirectory()
                val apkFile = File(downloadDir, "sharel.apk")
                
                if (!apkFile.exists()) {
                    val errorHtml = """
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>APK Not Available</title>
                            <style>
                                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; text-align: center; background: #f5f5f5; }
                                .container { background: white; padding: 40px; border-radius: 10px; max-width: 500px; margin: 0 auto; }
                                h1 { color: #333; }
                                p { color: #666; line-height: 1.6; }
                                a { color: #667eea; text-decoration: none; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <h1>APK Not Available</h1>
                                <p>The APK file is not currently available on this device.</p>
                                <p><a href="/">Back to Home</a></p>
                            </div>
                        </body>
                        </html>
                    """.trimIndent()
                    return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/html; charset=utf-8", errorHtml)
                }
                
                val fis = FileInputStream(apkFile)
                return newFixedLengthResponse(
                    Response.Status.OK,
                    "application/vnd.android.package-archive",
                    fis,
                    apkFile.length()
                )
            } catch (e: Exception) {
                return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "Download error: ${e.message}")
            }
        }
        
        private fun serveHomePage(clientIp: String = "Unknown"): Response {
            val html = """
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Sharel - File Sharing</title>
                    <style>
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            min-height: 100vh;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            padding: 20px;
                        }
                        
                        .container {
                            max-width: 600px;
                            background: white;
                            border-radius: 20px;
                            padding: 40px;
                            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                            text-align: center;
                        }
                        
                        .header {
                            margin-bottom: 30px;
                        }
                        
                        .logo {
                            width: 80px;
                            height: 80px;
                            margin: 0 auto 20px;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            border-radius: 20px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 40px;
                            color: white;
                            font-weight: bold;
                        }
                        
                        h1 {
                            color: #333;
                            font-size: 32px;
                            margin-bottom: 10px;
                        }
                        
                        .subtitle {
                            color: #666;
                            font-size: 16px;
                            line-height: 1.6;
                        }
                        
                        .features {
                            margin: 40px 0;
                            text-align: left;
                        }
                        
                        .feature {
                            display: flex;
                            align-items: center;
                            margin-bottom: 15px;
                            color: #555;
                        }
                        
                        .feature-icon {
                            width: 40px;
                            height: 40px;
                            background: #f0f0f0;
                            border-radius: 10px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            margin-right: 15px;
                            font-size: 20px;
                        }
                        
                        .buttons {
                            display: flex;
                            gap: 15px;
                            margin-top: 30px;
                            flex-direction: column;
                        }
                        
                        a {
                            padding: 15px 30px;
                            border-radius: 12px;
                            text-decoration: none;
                            font-weight: 600;
                            transition: all 0.3s ease;
                            border: none;
                            cursor: pointer;
                            font-size: 16px;
                        }
                        
                        .btn-primary {
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
                        }
                        
                        .btn-primary:hover {
                            transform: translateY(-2px);
                            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.6);
                        }
                        
                        .btn-secondary {
                            background: #f0f0f0;
                            color: #333;
                            border: 2px solid #ddd;
                        }
                        
                        .btn-secondary:hover {
                            background: #e8e8e8;
                            border-color: #999;
                        }
                        
                        .info-box {
                            background: #f9f9f9;
                            border-left: 4px solid #667eea;
                            padding: 20px;
                            border-radius: 8px;
                            margin-top: 30px;
                            text-align: left;
                        }
                        
                        .info-box h3 {
                            color: #333;
                            margin-bottom: 10px;
                            font-size: 14px;
                        }
                        
                        .info-box p {
                            color: #666;
                            font-size: 13px;
                            line-height: 1.6;
                            margin: 5px 0;
                            font-family: 'Courier New', monospace;
                        }
                        
                        .version {
                            color: #999;
                            font-size: 12px;
                            margin-top: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="logo">S</div>
                            <h1>Sharel</h1>
                            <p class="subtitle">Seamless File Sharing Between Devices</p>
                        </div>
                        
                        <div class="features">
                            <div class="feature">
                                <div class="feature-icon">📁</div>
                                <div>Share files instantly over WiFi</div>
                            </div>
                            <div class="feature">
                                <div class="feature-icon">⚡</div>
                                <div>Lightning-fast transfers</div>
                            </div>
                            <div class="feature">
                                <div class="feature-icon">🔒</div>
                                <div>Secure local network sharing</div>
                            </div>
                        </div>
                        
                        <div class="buttons">
                            <a href="https://play.google.com/store/apps/details?id=com.sharel.app" class="btn-primary" target="_blank">
                                Download from Play Store
                            </a>
                            <a href="/api/download-apk" class="btn-secondary">
                                Download APK Directly
                            </a>
                        </div>
                        
                        <div class="info-box">
                            <h3>Connected Device</h3>
                            <p>IP Address: ${clientIp}</p>
                            <p>Connected via local hotspot</p>
                        </div>
                        
                        <p class="version">Sharel v1.0.0</p>
                    </div>
                </body>
                </html>
            """.trimIndent()
            return newFixedLengthResponse(Response.Status.OK, "text/html; charset=utf-8", html)
        }
    }
}

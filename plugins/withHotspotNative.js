const { 
  withAndroidManifest, 
  withDangerousMod,
  withAppBuildGradle
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const HOTSPOT_MODULE_KT = `package com.sharel.app

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
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
    
    @ReactMethod
    fun connectToWifi(ssid: String, password: String, ipAddress: String, port: Int, promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            promise.reject("ERROR", "WiFi connection requires Android 10 or higher. Please connect manually to: \$ssid")
            return
        }
        
        Thread {
            try {
                connectToWifiAndroid10Plus(ssid, password, ipAddress, port, promise)
            } catch (e: Exception) {
                mainHandler.post {
                    promise.reject("WIFI_ERROR", "Failed to connect: \${e.message}")
                }
            }
        }.start()
    }
    
    @RequiresApi(Build.VERSION_CODES.Q)
    private fun connectToWifiAndroid10Plus(ssid: String, password: String, ipAddress: String, port: Int, promise: Promise) {
        val connectivityManager = reactApplicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        
        val specifier = WifiNetworkSpecifier.Builder()
            .setSsid(ssid)
            .setWpa2Passphrase(password)
            .build()
        
        val request = NetworkRequest.Builder()
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
            .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .setNetworkSpecifier(specifier)
            .build()
        
        networkCallback?.let { 
            try { connectivityManager.unregisterNetworkCallback(it) } catch (e: Exception) {}
        }
        
        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                connectedNetwork = network
                connectivityManager.bindProcessToNetwork(network)
                
                Thread {
                    try {
                        Thread.sleep(1000)
                        
                        val pingUrl = URL("http://\$ipAddress:\$port/join")
                        val connection = network.openConnection(pingUrl) as HttpURLConnection
                        connection.requestMethod = "GET"
                        connection.connectTimeout = 5000
                        connection.readTimeout = 5000
                        
                        val responseCode = connection.responseCode
                        connection.disconnect()
                        
                        mainHandler.post {
                            if (responseCode == 200) {
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
                                promise.reject("PING_ERROR", "Server responded with: \$responseCode")
                            }
                        }
                    } catch (e: Exception) {
                        mainHandler.post {
                            val result = Arguments.createMap().apply {
                                putBoolean("connected", true)
                                putString("ssid", ssid)
                                putString("ipAddress", ipAddress)
                                putInt("port", port)
                                putString("warning", "Connected but ping failed: \${e.message}")
                            }
                            promise.resolve(result)
                        }
                    }
                }.start()
            }
            
            override fun onUnavailable() {
                mainHandler.post {
                    promise.reject("WIFI_UNAVAILABLE", "WiFi network not available. Make sure the sender has the hotspot active.")
                }
            }
            
            override fun onLost(network: Network) {
                connectedNetwork = null
                val event = Arguments.createMap().apply {
                    putString("event", "disconnected")
                }
                sendEvent("onWifiConnectionChanged", event)
            }
        }
        
        connectivityManager.requestNetwork(request, networkCallback!!)
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
            promise.resolve(true)
        } catch (e: Exception) {
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
            promise.reject("PERMISSION_ERROR", "Location permission required: \${e.message}")
        } catch (e: Exception) {
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
                        putString("ssid", softApConfig?.ssid ?: "SHAREL_Hotspot")
                        putString("password", softApConfig?.passphrase ?: "")
                    } else {
                        @Suppress("DEPRECATION")
                        val wifiConfig = reservation?.wifiConfiguration
                        putString("ssid", wifiConfig?.SSID?.replace("\"", "") ?: "SHAREL_Hotspot")
                        putString("password", wifiConfig?.preSharedKey?.replace("\"", "") ?: "")
                    }
                    putString("ipAddress", getHotspotIpAddress())
                    putInt("port", 8080)
                    putBoolean("isActive", true)
                }
                
                mainHandler.post {
                    promise.resolve(result)
                }
            }
            
            override fun onStopped() {
                hotspotReservation = null
                val params = Arguments.createMap().apply {
                    putString("event", "stopped")
                }
                sendEvent("onHotspotStateChanged", params)
            }
            
            override fun onFailed(reason: Int) {
                val errorMsg = when (reason) {
                    WifiManager.LocalOnlyHotspotCallback.ERROR_NO_CHANNEL -> "No channel available"
                    WifiManager.LocalOnlyHotspotCallback.ERROR_GENERIC -> "Generic error"
                    WifiManager.LocalOnlyHotspotCallback.ERROR_INCOMPATIBLE_MODE -> "Incompatible mode - disable WiFi tethering first"
                    WifiManager.LocalOnlyHotspotCallback.ERROR_TETHERING_DISALLOWED -> "Tethering not allowed by policy"
                    else -> "Unknown error: \$reason"
                }
                mainHandler.post {
                    promise.reject("HOTSPOT_ERROR", errorMsg)
                }
            }
        }, mainHandler)
    }
    
    @ReactMethod
    fun stopLocalHotspot(promise: Promise) {
        try {
            hotspotReservation?.close()
            hotspotReservation = null
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to stop hotspot: \${e.message}")
        }
    }
    
    @ReactMethod
    fun isHotspotActive(promise: Promise) {
        promise.resolve(hotspotReservation != null)
    }
    
    @ReactMethod
    fun getHotspotInfo(promise: Promise) {
        if (hotspotReservation == null) {
            promise.resolve(null)
            return
        }
        
        val result = Arguments.createMap().apply {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val softApConfig = hotspotReservation?.softApConfiguration
                putString("ssid", softApConfig?.ssid ?: "")
                putString("password", softApConfig?.passphrase ?: "")
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                @Suppress("DEPRECATION")
                val wifiConfig = hotspotReservation?.wifiConfiguration
                putString("ssid", wifiConfig?.SSID?.replace("\"", "") ?: "")
                putString("password", wifiConfig?.preSharedKey?.replace("\"", "") ?: "")
            }
            putString("ipAddress", getHotspotIpAddress())
            putInt("port", 8080)
            putBoolean("isActive", true)
        }
        promise.resolve(result)
    }
    
    private fun getHotspotIpAddress(): String {
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces() ?: return "192.168.43.1"
            
            // Priority 1: Look for typical hotspot interface names with 192.168.43.x range
            for (networkInterface in interfaces.asSequence()) {
                val name = networkInterface.name.lowercase()
                if (name.contains("ap") || name.contains("swlan") || name.contains("softap") || name.contains("p2p")) {
                    for (address in networkInterface.inetAddresses.asSequence()) {
                        if (!address.isLoopbackAddress && address is Inet4Address) {
                            val hostAddress = address.hostAddress
                            if (hostAddress != null && hostAddress.startsWith("192.168.43.")) {
                                return hostAddress
                            }
                        }
                    }
                }
            }
            
            // Priority 2: Any interface with 192.168.43.x (default Android hotspot range)
            for (networkInterface in NetworkInterface.getNetworkInterfaces().asSequence()) {
                if (!networkInterface.isLoopback && networkInterface.isUp) {
                    for (address in networkInterface.inetAddresses.asSequence()) {
                        if (!address.isLoopbackAddress && address is Inet4Address) {
                            val hostAddress = address.hostAddress
                            if (hostAddress != null && hostAddress.startsWith("192.168.43.")) {
                                return hostAddress
                            }
                        }
                    }
                }
            }
            
            // Priority 3: Look for hotspot-like interfaces with any 192.168.x.x
            for (networkInterface in NetworkInterface.getNetworkInterfaces().asSequence()) {
                val name = networkInterface.name.lowercase()
                if (name.contains("ap") || name.contains("swlan") || name.contains("softap") || name.contains("wlan")) {
                    for (address in networkInterface.inetAddresses.asSequence()) {
                        if (!address.isLoopbackAddress && address is Inet4Address) {
                            val hostAddress = address.hostAddress
                            if (hostAddress != null && hostAddress.startsWith("192.168.")) {
                                return hostAddress
                            }
                        }
                    }
                }
            }
            
            // Fallback: any 192.168.x.x address
            for (networkInterface in NetworkInterface.getNetworkInterfaces().asSequence()) {
                if (!networkInterface.isLoopback && networkInterface.isUp) {
                    for (address in networkInterface.inetAddresses.asSequence()) {
                        if (!address.isLoopbackAddress && address is Inet4Address) {
                            val hostAddress = address.hostAddress
                            if (hostAddress != null && hostAddress.startsWith("192.168.")) {
                                return hostAddress
                            }
                        }
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return "192.168.43.1"
    }
    
    @ReactMethod
    fun addListener(eventName: String) {}
    
    @ReactMethod
    fun removeListeners(count: Int) {}
}
`;

const HTTP_SERVER_MODULE_KT = `package com.sharel.app

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
                android.util.Log.d("SharelHttpServer", "Server already running on port \$port")
                promise.resolve(true)
                return
            }
            
            android.util.Log.d("SharelHttpServer", "Starting server on port \$port...")
            server = SharelHttpServer(port, this)
            server?.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false)
            
            // Verify server is actually running
            val isRunning = server?.isAlive == true
            android.util.Log.d("SharelHttpServer", "Server started: \$isRunning, port: \$port")
            
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
                                android.util.Log.d("SharelHttpServer", "Interface: \${ni.name}, IP: \${addr.hostAddress}")
                            }
                        }
                    }
                } catch (e: Exception) {
                    android.util.Log.e("SharelHttpServer", "Error listing interfaces: \${e.message}")
                }
                
                promise.resolve(true)
            } else {
                promise.reject("SERVER_ERROR", "Server failed to start - not alive after start()")
            }
        } catch (e: Exception) {
            android.util.Log.e("SharelHttpServer", "Failed to start server: \${e.message}", e)
            promise.reject("SERVER_ERROR", "Failed to start server: \${e.message}")
        }
    }
    
    @ReactMethod
    fun stopServer(promise: Promise) {
        try {
            server?.stop()
            server = null
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SERVER_ERROR", "Failed to stop server: \${e.message}")
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
                
                else -> newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "Not Found: \$uri")
            }
        }
        
        private fun handleUpload(session: IHTTPSession): Response {
            try {
                val files = HashMap<String, String>()
                session.parseBody(files)
                
                val fileName = session.parameters["filename"]?.firstOrNull() 
                    ?: "file_\${System.currentTimeMillis()}"
                
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
                            """{"success":true,"path":"\$savedPath"}"""
                        )
                    }
                    
                    return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "Failed to save file")
                }
                
                return newFixedLengthResponse(Response.Status.BAD_REQUEST, "text/plain", "No file provided")
            } catch (e: Exception) {
                return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "Upload failed: \${e.message}")
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
                return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "Download failed: \${e.message}")
            }
        }
        
        private fun listAvailableFiles(): Response {
            val downloadDir = module.getSharelDownloadDirectory()
            val dir = File(downloadDir)
            val files = dir.listFiles()?.map { 
                """{"name":"\${it.name}","size":\${it.length()}}"""
            }?.joinToString(",") ?: ""
            return newFixedLengthResponse(Response.Status.OK, "application/json", """{"files":[\$files]}""")
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
                return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "Download error: \${e.message}")
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
                            <p>IP Address: \${clientIp}</p>
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
`;

const STORAGE_MODULE_KT = `package com.sharel.app

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
            promise.reject("ERROR", "Failed to check permission: \${e.message}")
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
            intent.data = Uri.parse("package:\${reactApplicationContext.packageName}")
            activity.startActivity(intent)
        } catch (e: Exception) {
            try {
                val intent = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
                activity.startActivity(intent)
            } catch (e2: Exception) {
                pendingPromise = null
                promise.reject("ERROR", "Cannot open storage permission settings: \${e2.message}")
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
            intent.data = Uri.parse("package:\${reactApplicationContext.packageName}")
            activity.startActivity(intent)
        } catch (e: Exception) {
            try {
                val intent = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
                activity.startActivity(intent)
            } catch (e2: Exception) {
                pendingPromise = null
                promise.reject("ERROR", "Cannot open storage settings: \${e2.message}")
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
                promise.reject("CREATE_FAILED", "Failed to create Sharel folder at: \$rootPath/Sharel")
            }
        } catch (e: SecurityException) {
            promise.reject("SECURITY_ERROR", "Permission denied: \${e.message}")
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to create folder: \${e.message}")
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
            promise.reject("ERROR", "Failed to get folder path: \${e.message}")
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
            promise.reject("ERROR", "Failed to list folder: \${e.message}")
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
                File(rootPath, "Sharel/\$subfolder")
            } else {
                File(rootPath, "Sharel")
            }
            
            if (!destDir.exists()) {
                destDir.mkdirs()
            }
            
            val sourceFile = File(sourcePath)
            if (!sourceFile.exists()) {
                promise.reject("SOURCE_NOT_FOUND", "Source file not found: \$sourcePath")
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
            promise.reject("ERROR", "Failed to save file: \${e.message}")
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
            promise.reject("ERROR", "Failed to delete: \${e.message}")
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
            promise.reject("ERROR", "Failed to get storage info: \${e.message}")
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
            promise.reject("ERROR", "Failed to initialize app directories: \${e.message}")
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
            promise.reject("ERROR", "Failed to get app directories: \${e.message}")
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
`;

const LOG_MODULE_KT = `package com.sharel.app

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
`;

const WIFI_DIRECT_MODULE_KT = `package com.sharel.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.wifi.p2p.*
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class WifiDirectModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    companion object {
        private const val TAG = "WifiDirectModule"
    }
    
    private var wifiP2pManager: WifiP2pManager? = null
    private var channel: WifiP2pManager.Channel? = null
    private var receiver: BroadcastReceiver? = null
    private var isReceiverRegistered = false
    private var isInitialized = false
    private var discoveredPeers: MutableList<WifiP2pDevice> = mutableListOf()
    private var connectionInfo: WifiP2pInfo? = null
    
    override fun getName(): String = "WifiDirectModule"
    
    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
    
    @ReactMethod
    fun initialize(promise: Promise) {
        try {
            if (isInitialized) {
                val result = Arguments.createMap().apply {
                    putBoolean("success", true)
                    putBoolean("isSupported", true)
                }
                promise.resolve(result)
                return
            }
            
            wifiP2pManager = reactApplicationContext.getSystemService(Context.WIFI_P2P_SERVICE) as? WifiP2pManager
            
            if (wifiP2pManager == null) {
                val result = Arguments.createMap().apply {
                    putBoolean("success", false)
                    putBoolean("isSupported", false)
                    putString("error", "Wi-Fi Direct not supported on this device")
                }
                promise.resolve(result)
                return
            }
            
            channel = wifiP2pManager?.initialize(reactApplicationContext, Looper.getMainLooper()) { 
                Log.d(TAG, "Channel disconnected")
                sendEvent("onWifiDirectEvent", Arguments.createMap().apply {
                    putString("event", "disconnected")
                    putString("message", "Wi-Fi Direct channel disconnected")
                })
            }
            
            if (channel == null) {
                val result = Arguments.createMap().apply {
                    putBoolean("success", false)
                    putBoolean("isSupported", false)
                    putString("error", "Failed to initialize Wi-Fi Direct channel")
                }
                promise.resolve(result)
                return
            }
            
            registerReceiver()
            isInitialized = true
            
            val result = Arguments.createMap().apply {
                putBoolean("success", true)
                putBoolean("isSupported", true)
            }
            promise.resolve(result)
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize Wi-Fi Direct", e)
            val result = Arguments.createMap().apply {
                putBoolean("success", false)
                putBoolean("isSupported", false)
                putString("error", e.message ?: "Unknown error")
            }
            promise.resolve(result)
        }
    }
    
    private fun registerReceiver() {
        if (isReceiverRegistered) return
        
        val intentFilter = IntentFilter().apply {
            addAction(WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION)
        }
        
        receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                when (intent.action) {
                    WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION -> {
                        val state = intent.getIntExtra(WifiP2pManager.EXTRA_WIFI_STATE, -1)
                        val isEnabled = state == WifiP2pManager.WIFI_P2P_STATE_ENABLED
                        sendEvent("onWifiDirectEvent", Arguments.createMap().apply {
                            putString("event", "wifiP2pStateChanged")
                            putBoolean("isEnabled", isEnabled)
                        })
                    }
                    
                    WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION -> {
                        requestPeers()
                    }
                    
                    WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION -> {
                        val networkInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            intent.getParcelableExtra(WifiP2pManager.EXTRA_WIFI_P2P_INFO, WifiP2pInfo::class.java)
                        } else {
                            @Suppress("DEPRECATION")
                            intent.getParcelableExtra(WifiP2pManager.EXTRA_WIFI_P2P_INFO)
                        }
                        connectionInfo = networkInfo
                        
                        if (networkInfo?.groupFormed == true) {
                            sendEvent("onWifiDirectEvent", Arguments.createMap().apply {
                                putString("event", "connected")
                                putBoolean("isGroupOwner", networkInfo.isGroupOwner)
                                putBoolean("groupFormed", true)
                                putString("groupOwnerAddress", networkInfo.groupOwnerAddress?.hostAddress ?: "")
                            })
                        } else {
                            sendEvent("onWifiDirectEvent", Arguments.createMap().apply {
                                putString("event", "disconnected")
                                putBoolean("groupFormed", false)
                            })
                        }
                    }
                    
                    WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION -> {
                        val device = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            intent.getParcelableExtra(WifiP2pManager.EXTRA_WIFI_P2P_DEVICE, WifiP2pDevice::class.java)
                        } else {
                            @Suppress("DEPRECATION")
                            intent.getParcelableExtra(WifiP2pManager.EXTRA_WIFI_P2P_DEVICE)
                        }
                        device?.let {
                            sendEvent("onWifiDirectEvent", Arguments.createMap().apply {
                                putString("event", "thisDeviceChanged")
                                putString("deviceName", it.deviceName)
                                putString("deviceAddress", it.deviceAddress)
                                putInt("status", it.status)
                            })
                        }
                    }
                }
            }
        }
        
        reactApplicationContext.registerReceiver(receiver, intentFilter)
        isReceiverRegistered = true
    }
    
    private fun requestPeers() {
        try {
            wifiP2pManager?.requestPeers(channel) { peerList ->
                discoveredPeers.clear()
                discoveredPeers.addAll(peerList.deviceList)
                
                val peersArray = Arguments.createArray()
                peerList.deviceList.forEach { device ->
                    peersArray.pushMap(Arguments.createMap().apply {
                        putString("deviceName", device.deviceName)
                        putString("deviceAddress", device.deviceAddress)
                        putInt("status", device.status)
                        putBoolean("isGroupOwner", device.isGroupOwner)
                    })
                }
                
                sendEvent("onWifiDirectEvent", Arguments.createMap().apply {
                    putString("event", "peersChanged")
                    putArray("peers", peersArray)
                })
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "Security exception requesting peers", e)
        }
    }
    
    @ReactMethod
    fun checkPermissions(promise: Promise) {
        val result = Arguments.createMap().apply {
            putBoolean("hasPermissions", true)
            putBoolean("requiresNearbyWifi", Build.VERSION.SDK_INT >= 33)
        }
        promise.resolve(result)
    }
    
    @ReactMethod
    fun discoverPeers(promise: Promise) {
        if (!isInitialized || wifiP2pManager == null || channel == null) {
            promise.reject("NOT_INITIALIZED", "Wi-Fi Direct not initialized")
            return
        }
        
        try {
            wifiP2pManager?.discoverPeers(channel, object : WifiP2pManager.ActionListener {
                override fun onSuccess() {
                    promise.resolve(true)
                }
                override fun onFailure(reason: Int) {
                    val errorMsg = when (reason) {
                        WifiP2pManager.P2P_UNSUPPORTED -> "P2P unsupported"
                        WifiP2pManager.BUSY -> "Framework busy"
                        WifiP2pManager.ERROR -> "Internal error"
                        else -> "Unknown error: \$reason"
                    }
                    promise.reject("DISCOVER_FAILED", errorMsg)
                }
            })
        } catch (e: SecurityException) {
            promise.reject("PERMISSION_DENIED", "Location permission required: \${e.message}")
        }
    }
    
    @ReactMethod
    fun stopDiscovery(promise: Promise) {
        if (wifiP2pManager == null || channel == null) {
            promise.resolve(true)
            return
        }
        
        wifiP2pManager?.stopPeerDiscovery(channel, object : WifiP2pManager.ActionListener {
            override fun onSuccess() { promise.resolve(true) }
            override fun onFailure(reason: Int) { promise.resolve(false) }
        })
    }
    
    @ReactMethod
    fun connect(deviceAddress: String, promise: Promise) {
        if (!isInitialized || wifiP2pManager == null || channel == null) {
            promise.reject("NOT_INITIALIZED", "Wi-Fi Direct not initialized")
            return
        }
        
        val config = WifiP2pConfig().apply {
            this.deviceAddress = deviceAddress
        }
        
        try {
            wifiP2pManager?.connect(channel, config, object : WifiP2pManager.ActionListener {
                override fun onSuccess() { promise.resolve(true) }
                override fun onFailure(reason: Int) {
                    promise.reject("CONNECT_FAILED", "Connection failed: \$reason")
                }
            })
        } catch (e: SecurityException) {
            promise.reject("PERMISSION_DENIED", "Permission required: \${e.message}")
        }
    }
    
    @ReactMethod
    fun disconnect(promise: Promise) {
        if (wifiP2pManager == null || channel == null) {
            promise.resolve(true)
            return
        }
        
        wifiP2pManager?.removeGroup(channel, object : WifiP2pManager.ActionListener {
            override fun onSuccess() { promise.resolve(true) }
            override fun onFailure(reason: Int) { promise.resolve(false) }
        })
    }
    
    @ReactMethod
    fun getConnectionInfo(promise: Promise) {
        if (connectionInfo == null) {
            promise.resolve(null)
            return
        }
        
        val result = Arguments.createMap().apply {
            putBoolean("isGroupOwner", connectionInfo?.isGroupOwner ?: false)
            putBoolean("groupFormed", connectionInfo?.groupFormed ?: false)
            putString("groupOwnerAddress", connectionInfo?.groupOwnerAddress?.hostAddress ?: "")
        }
        promise.resolve(result)
    }
    
    @ReactMethod
    fun getDiscoveredPeers(promise: Promise) {
        val peersArray = Arguments.createArray()
        discoveredPeers.forEach { device ->
            peersArray.pushMap(Arguments.createMap().apply {
                putString("deviceName", device.deviceName)
                putString("deviceAddress", device.deviceAddress)
                putInt("status", device.status)
                putBoolean("isGroupOwner", device.isGroupOwner)
            })
        }
        promise.resolve(peersArray)
    }
    
    @ReactMethod
    fun isWifiP2pEnabled(promise: Promise) {
        val wifiManager = reactApplicationContext.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
        promise.resolve(wifiManager?.isWifiEnabled == true)
    }
    
    @ReactMethod
    fun startReceiver(promise: Promise) {
        registerReceiver()
        promise.resolve(true)
    }
    
    @ReactMethod
    fun stopReceiver(promise: Promise) {
        if (isReceiverRegistered && receiver != null) {
            try {
                reactApplicationContext.unregisterReceiver(receiver)
                isReceiverRegistered = false
            } catch (e: Exception) {
                Log.e(TAG, "Error unregistering receiver", e)
            }
        }
        promise.resolve(true)
    }
    
    @ReactMethod
    fun cleanup(promise: Promise) {
        try {
            stopReceiver(PromiseImpl({}, {}))
            discoveredPeers.clear()
            connectionInfo = null
            isInitialized = false
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CLEANUP_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun addListener(eventName: String) {}
    
    @ReactMethod
    fun removeListeners(count: Int) {}
}
`;

const FILE_EXPLORER_MODULE_KT = `package com.sharel.app

import android.content.Context
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.webkit.MimeTypeMap
import com.facebook.react.bridge.*
import java.io.*

class FileExplorerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
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
                    putString("uri", "file://\${file.absolutePath}")
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
`;

const MEDIA_GALLERY_MODULE_KT = `package com.sharel.app

import android.content.ContentResolver
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import com.facebook.react.bridge.*

class MediaGalleryModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    override fun getName(): String = "MediaGalleryModule"
    
    @ReactMethod
    fun getImages(limit: Int, offset: Int, promise: Promise) {
        getMediaItems(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, "image", limit, offset, promise)
    }
    
    @ReactMethod
    fun getVideos(limit: Int, offset: Int, promise: Promise) {
        getMediaItems(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, "video", limit, offset, promise)
    }
    
    @ReactMethod
    fun getAudio(limit: Int, offset: Int, promise: Promise) {
        getMediaItems(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, "audio", limit, offset, promise)
    }
    
    private fun getMediaItems(uri: Uri, mediaType: String, limit: Int, offset: Int, promise: Promise) {
        try {
            val projection = arrayOf(
                MediaStore.MediaColumns._ID,
                MediaStore.MediaColumns.DISPLAY_NAME,
                MediaStore.MediaColumns.DATA,
                MediaStore.MediaColumns.SIZE,
                MediaStore.MediaColumns.DATE_ADDED,
                MediaStore.MediaColumns.MIME_TYPE
            )
            
            val sortOrder = "\${MediaStore.MediaColumns.DATE_ADDED} DESC LIMIT \$limit OFFSET \$offset"
            val cursor = reactApplicationContext.contentResolver.query(uri, projection, null, null, sortOrder)
            
            val result = Arguments.createArray()
            cursor?.use {
                while (it.moveToNext()) {
                    val id = it.getString(it.getColumnIndexOrThrow(MediaStore.MediaColumns._ID))
                    val name = it.getString(it.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME))
                    val path = it.getString(it.getColumnIndexOrThrow(MediaStore.MediaColumns.DATA)) ?: ""
                    val size = it.getLong(it.getColumnIndexOrThrow(MediaStore.MediaColumns.SIZE))
                    val dateAdded = it.getLong(it.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_ADDED))
                    val mimeType = it.getString(it.getColumnIndexOrThrow(MediaStore.MediaColumns.MIME_TYPE)) ?: ""
                    
                    result.pushMap(Arguments.createMap().apply {
                        putString("id", id)
                        putString("uri", "file://\$path")
                        putString("path", path)
                        putString("filename", name)
                        putDouble("fileSize", size.toDouble())
                        putDouble("creationTime", dateAdded * 1000.0)
                        putString("mimeType", mimeType)
                        putString("mediaType", mediaType)
                    })
                }
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("MEDIA_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun getMediaCounts(promise: Promise) {
        try {
            val images = getCount(MediaStore.Images.Media.EXTERNAL_CONTENT_URI)
            val videos = getCount(MediaStore.Video.Media.EXTERNAL_CONTENT_URI)
            val audio = getCount(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI)
            
            val result = Arguments.createMap().apply {
                putInt("images", images)
                putInt("videos", videos)
                putInt("audio", audio)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("COUNT_ERROR", e.message)
        }
    }
    
    private fun getCount(uri: Uri): Int {
        val cursor = reactApplicationContext.contentResolver.query(uri, arrayOf("COUNT(*)"), null, null, null)
        cursor?.use {
            if (it.moveToFirst()) return it.getInt(0)
        }
        return 0
    }
    
    @ReactMethod
    fun getAlbums(promise: Promise) {
        try {
            val projection = arrayOf(
                MediaStore.Images.Media.BUCKET_ID,
                MediaStore.Images.Media.BUCKET_DISPLAY_NAME,
                MediaStore.Images.Media.DATA
            )
            
            val cursor = reactApplicationContext.contentResolver.query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                projection, null, null,
                "\${MediaStore.Images.Media.DATE_ADDED} DESC"
            )
            
            val albumMap = mutableMapOf<String, Pair<String, String>>()
            val albumCounts = mutableMapOf<String, Int>()
            
            cursor?.use {
                while (it.moveToNext()) {
                    val bucketId = it.getString(it.getColumnIndexOrThrow(MediaStore.Images.Media.BUCKET_ID)) ?: continue
                    val bucketName = it.getString(it.getColumnIndexOrThrow(MediaStore.Images.Media.BUCKET_DISPLAY_NAME)) ?: "Unknown"
                    val path = it.getString(it.getColumnIndexOrThrow(MediaStore.Images.Media.DATA)) ?: ""
                    
                    if (!albumMap.containsKey(bucketId)) {
                        albumMap[bucketId] = Pair(bucketName, path)
                    }
                    albumCounts[bucketId] = (albumCounts[bucketId] ?: 0) + 1
                }
            }
            
            val result = Arguments.createArray()
            albumMap.forEach { (id, pair) ->
                result.pushMap(Arguments.createMap().apply {
                    putString("id", id)
                    putString("name", pair.first)
                    putInt("count", albumCounts[id] ?: 0)
                    putString("thumbnailUri", "file://\${pair.second}")
                })
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ALBUMS_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun getAlbumImages(albumId: String, limit: Int, offset: Int, promise: Promise) {
        try {
            val projection = arrayOf(
                MediaStore.Images.Media._ID,
                MediaStore.Images.Media.DISPLAY_NAME,
                MediaStore.Images.Media.DATA,
                MediaStore.Images.Media.SIZE,
                MediaStore.Images.Media.DATE_ADDED,
                MediaStore.Images.Media.MIME_TYPE
            )
            
            val selection = "\${MediaStore.Images.Media.BUCKET_ID} = ?"
            val selectionArgs = arrayOf(albumId)
            val sortOrder = "\${MediaStore.Images.Media.DATE_ADDED} DESC LIMIT \$limit OFFSET \$offset"
            
            val cursor = reactApplicationContext.contentResolver.query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                projection, selection, selectionArgs, sortOrder
            )
            
            val result = Arguments.createArray()
            cursor?.use {
                while (it.moveToNext()) {
                    val id = it.getString(it.getColumnIndexOrThrow(MediaStore.Images.Media._ID))
                    val name = it.getString(it.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME))
                    val path = it.getString(it.getColumnIndexOrThrow(MediaStore.Images.Media.DATA)) ?: ""
                    val size = it.getLong(it.getColumnIndexOrThrow(MediaStore.Images.Media.SIZE))
                    val dateAdded = it.getLong(it.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_ADDED))
                    val mimeType = it.getString(it.getColumnIndexOrThrow(MediaStore.Images.Media.MIME_TYPE)) ?: ""
                    
                    result.pushMap(Arguments.createMap().apply {
                        putString("id", id)
                        putString("uri", "file://\$path")
                        putString("path", path)
                        putString("filename", name)
                        putDouble("fileSize", size.toDouble())
                        putDouble("creationTime", dateAdded * 1000.0)
                        putString("mimeType", mimeType)
                        putString("mediaType", "image")
                    })
                }
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ALBUM_IMAGES_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun addListener(eventName: String) {}
    
    @ReactMethod
    fun removeListeners(count: Int) {}
}
`;

const CONTACTS_MODULE_KT = `package com.sharel.app

import android.content.ContentResolver
import android.provider.ContactsContract
import com.facebook.react.bridge.*

class ContactsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    override fun getName(): String = "ContactsModule"
    
    @ReactMethod
    fun getContacts(limit: Int, offset: Int, promise: Promise) {
        try {
            val contacts = fetchContacts(limit, offset)
            promise.resolve(contacts)
        } catch (e: Exception) {
            promise.reject("CONTACTS_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun getAllContacts(promise: Promise) {
        try {
            val contacts = fetchContacts(-1, 0)
            promise.resolve(contacts)
        } catch (e: Exception) {
            promise.reject("CONTACTS_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun getContactsCount(promise: Promise) {
        try {
            val cursor = reactApplicationContext.contentResolver.query(
                ContactsContract.Contacts.CONTENT_URI,
                arrayOf("COUNT(*)"), null, null, null
            )
            cursor?.use {
                if (it.moveToFirst()) {
                    promise.resolve(it.getInt(0))
                    return
                }
            }
            promise.resolve(0)
        } catch (e: Exception) {
            promise.reject("COUNT_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun searchContacts(query: String, limit: Int, promise: Promise) {
        try {
            val selection = "\${ContactsContract.Contacts.DISPLAY_NAME_PRIMARY} LIKE ?"
            val selectionArgs = arrayOf("%\$query%")
            val contacts = fetchContactsWithSelection(selection, selectionArgs, limit)
            promise.resolve(contacts)
        } catch (e: Exception) {
            promise.reject("SEARCH_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun getContactById(contactId: String, promise: Promise) {
        try {
            val selection = "\${ContactsContract.Contacts._ID} = ?"
            val selectionArgs = arrayOf(contactId)
            val contacts = fetchContactsWithSelection(selection, selectionArgs, 1)
            if (contacts.size() > 0) {
                promise.resolve(contacts.getMap(0))
            } else {
                promise.resolve(null)
            }
        } catch (e: Exception) {
            promise.reject("CONTACT_ERROR", e.message)
        }
    }
    
    private fun fetchContacts(limit: Int, offset: Int): WritableArray {
        val limitClause = if (limit > 0) " LIMIT \$limit OFFSET \$offset" else ""
        return fetchContactsWithSelection(null, null, limit, offset)
    }
    
    private fun fetchContactsWithSelection(selection: String?, selectionArgs: Array<String>?, limit: Int, offset: Int = 0): WritableArray {
        val result = Arguments.createArray()
        val contentResolver = reactApplicationContext.contentResolver
        
        val projection = arrayOf(
            ContactsContract.Contacts._ID,
            ContactsContract.Contacts.DISPLAY_NAME_PRIMARY,
            ContactsContract.Contacts.HAS_PHONE_NUMBER,
            ContactsContract.Contacts.PHOTO_URI,
            ContactsContract.Contacts.PHOTO_THUMBNAIL_URI
        )
        
        val sortOrder = if (limit > 0) {
            "\${ContactsContract.Contacts.DISPLAY_NAME_PRIMARY} ASC LIMIT \$limit OFFSET \$offset"
        } else {
            "\${ContactsContract.Contacts.DISPLAY_NAME_PRIMARY} ASC"
        }
        
        val cursor = contentResolver.query(
            ContactsContract.Contacts.CONTENT_URI,
            projection, selection, selectionArgs, sortOrder
        )
        
        cursor?.use {
            while (it.moveToNext()) {
                val id = it.getString(it.getColumnIndexOrThrow(ContactsContract.Contacts._ID))
                val name = it.getString(it.getColumnIndexOrThrow(ContactsContract.Contacts.DISPLAY_NAME_PRIMARY)) ?: ""
                val hasPhone = it.getInt(it.getColumnIndexOrThrow(ContactsContract.Contacts.HAS_PHONE_NUMBER)) > 0
                val photoUri = it.getString(it.getColumnIndexOrThrow(ContactsContract.Contacts.PHOTO_URI)) ?: ""
                val thumbnailUri = it.getString(it.getColumnIndexOrThrow(ContactsContract.Contacts.PHOTO_THUMBNAIL_URI)) ?: ""
                
                val phoneNumbers = Arguments.createArray()
                val emails = Arguments.createArray()
                
                if (hasPhone) {
                    val phoneCursor = contentResolver.query(
                        ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                        arrayOf(
                            ContactsContract.CommonDataKinds.Phone.NUMBER,
                            ContactsContract.CommonDataKinds.Phone.TYPE
                        ),
                        "\${ContactsContract.CommonDataKinds.Phone.CONTACT_ID} = ?",
                        arrayOf(id), null
                    )
                    phoneCursor?.use { pc ->
                        while (pc.moveToNext()) {
                            val number = pc.getString(0) ?: ""
                            val type = pc.getInt(1)
                            phoneNumbers.pushMap(Arguments.createMap().apply {
                                putString("number", number)
                                putString("type", getPhoneType(type))
                            })
                        }
                    }
                }
                
                val emailCursor = contentResolver.query(
                    ContactsContract.CommonDataKinds.Email.CONTENT_URI,
                    arrayOf(
                        ContactsContract.CommonDataKinds.Email.ADDRESS,
                        ContactsContract.CommonDataKinds.Email.TYPE
                    ),
                    "\${ContactsContract.CommonDataKinds.Email.CONTACT_ID} = ?",
                    arrayOf(id), null
                )
                emailCursor?.use { ec ->
                    while (ec.moveToNext()) {
                        val email = ec.getString(0) ?: ""
                        val type = ec.getInt(1)
                        emails.pushMap(Arguments.createMap().apply {
                            putString("email", email)
                            putString("type", getEmailType(type))
                        })
                    }
                }
                
                result.pushMap(Arguments.createMap().apply {
                    putString("id", id)
                    putString("name", name)
                    putBoolean("hasPhoneNumber", hasPhone)
                    putString("photoUri", photoUri)
                    putString("thumbnailUri", thumbnailUri)
                    putArray("phoneNumbers", phoneNumbers)
                    putArray("emails", emails)
                })
            }
        }
        
        return result
    }
    
    private fun getPhoneType(type: Int): String {
        return when (type) {
            ContactsContract.CommonDataKinds.Phone.TYPE_HOME -> "home"
            ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE -> "mobile"
            ContactsContract.CommonDataKinds.Phone.TYPE_WORK -> "work"
            else -> "other"
        }
    }
    
    private fun getEmailType(type: Int): String {
        return when (type) {
            ContactsContract.CommonDataKinds.Email.TYPE_HOME -> "home"
            ContactsContract.CommonDataKinds.Email.TYPE_WORK -> "work"
            else -> "other"
        }
    }
    
    @ReactMethod
    fun addListener(eventName: String) {}
    
    @ReactMethod
    fun removeListeners(count: Int) {}
}
`;

const APPS_MODULE_KT = `package com.sharel.app

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
            val cacheKey = "\${packageName}_\${size}"
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
                    putString("uri", "file://\${file.absolutePath}")
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
`;

const SHAREL_PACKAGE_KT = `package com.sharel.app

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
    
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;

function withHotspotNative(config) {
  config = withAndroidManifest(config, async (config) => {
    const permissions = config.modResults.manifest["uses-permission"] || [];
    
    const hotspotPermissions = [
      "android.permission.ACCESS_WIFI_STATE",
      "android.permission.CHANGE_WIFI_STATE",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.INTERNET",
      "android.permission.ACCESS_NETWORK_STATE",
      "android.permission.CHANGE_NETWORK_STATE",
    ];
    
    hotspotPermissions.forEach((permission) => {
      if (!permissions.some((p) => p.$?.["android:name"] === permission)) {
        permissions.push({
          $: { "android:name": permission },
        });
      }
    });
    
    config.modResults.manifest["uses-permission"] = permissions;
    
    return config;
  });
  
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformProjectRoot = config.modRequest.platformProjectRoot;
      const packageName = config.android?.package || "com.sharel.app";
      const packagePath = packageName.replace(/\./g, "/");
      
      const kotlinDir = path.join(
        platformProjectRoot,
        "app",
        "src",
        "main",
        "java",
        packagePath
      );
      
      console.log("[withHotspotNative] Writing Kotlin files to:", kotlinDir);
      
      if (!fs.existsSync(kotlinDir)) {
        fs.mkdirSync(kotlinDir, { recursive: true });
      }
      
      fs.writeFileSync(
        path.join(kotlinDir, "HotspotModule.kt"),
        HOTSPOT_MODULE_KT
      );
      console.log("[withHotspotNative] Wrote HotspotModule.kt");
      
      fs.writeFileSync(
        path.join(kotlinDir, "HttpServerModule.kt"),
        HTTP_SERVER_MODULE_KT
      );
      console.log("[withHotspotNative] Wrote HttpServerModule.kt");
      
      fs.writeFileSync(
        path.join(kotlinDir, "StorageModule.kt"),
        STORAGE_MODULE_KT
      );
      console.log("[withHotspotNative] Wrote StorageModule.kt");
      
      fs.writeFileSync(
        path.join(kotlinDir, "LogModule.kt"),
        LOG_MODULE_KT
      );
      console.log("[withHotspotNative] Wrote LogModule.kt");
      
      fs.writeFileSync(
        path.join(kotlinDir, "WifiDirectModule.kt"),
        WIFI_DIRECT_MODULE_KT
      );
      console.log("[withHotspotNative] Wrote WifiDirectModule.kt");
      
      fs.writeFileSync(
        path.join(kotlinDir, "FileExplorerModule.kt"),
        FILE_EXPLORER_MODULE_KT
      );
      console.log("[withHotspotNative] Wrote FileExplorerModule.kt");
      
      fs.writeFileSync(
        path.join(kotlinDir, "MediaGalleryModule.kt"),
        MEDIA_GALLERY_MODULE_KT
      );
      console.log("[withHotspotNative] Wrote MediaGalleryModule.kt");
      
      fs.writeFileSync(
        path.join(kotlinDir, "ContactsModule.kt"),
        CONTACTS_MODULE_KT
      );
      console.log("[withHotspotNative] Wrote ContactsModule.kt");
      
      fs.writeFileSync(
        path.join(kotlinDir, "AppsModule.kt"),
        APPS_MODULE_KT
      );
      console.log("[withHotspotNative] Wrote AppsModule.kt");
      
      fs.writeFileSync(
        path.join(kotlinDir, "SharelPackage.kt"),
        SHAREL_PACKAGE_KT
      );
      console.log("[withHotspotNative] Wrote SharelPackage.kt");
      
      const mainApplicationPath = path.join(
        platformProjectRoot,
        "app",
        "src",
        "main",
        "java",
        packagePath,
        "MainApplication.kt"
      );
      
      console.log("[withHotspotNative] Looking for MainApplication.kt at:", mainApplicationPath);
      
      if (fs.existsSync(mainApplicationPath)) {
        let contents = fs.readFileSync(mainApplicationPath, "utf-8");
        console.log("[withHotspotNative] Found MainApplication.kt, content length:", contents.length);
        console.log("[withHotspotNative] MainApplication.kt first 500 chars:", contents.substring(0, 500));
        
        const importStatement = `import ${packageName}.SharelPackage`;
        let modified = false;
        
        if (!contents.includes("SharelPackage")) {
          console.log("[withHotspotNative] SharelPackage not found, adding...");
          
          if (!contents.includes(importStatement)) {
            const packageMatch = contents.match(/^package\s+[^\n]+\n/m);
            if (packageMatch) {
              const insertPos = packageMatch.index + packageMatch[0].length;
              contents = contents.slice(0, insertPos) + `\n${importStatement}\n` + contents.slice(insertPos);
              console.log("[withHotspotNative] Added import statement");
              modified = true;
            }
          }
          
          if (contents.includes("PackageList(this).packages.apply")) {
            console.log("[withHotspotNative] Found existing apply block, injecting SharelPackage");
            if (!contents.includes("add(SharelPackage())")) {
              contents = contents.replace(
                /PackageList\(this\)\.packages\.apply\s*\{/g,
                "PackageList(this).packages.apply { add(SharelPackage());"
              );
              modified = true;
            }
          } else if (contents.includes("PackageList(this).packages")) {
            console.log("[withHotspotNative] Found PackageList(this).packages pattern");
            contents = contents.replace(
              /PackageList\(this\)\.packages(?!\.apply)/g,
              "PackageList(this).packages.apply { add(SharelPackage()) }"
            );
            modified = true;
          } else if (contents.includes("PackageList(this).getPackages().apply")) {
            console.log("[withHotspotNative] Found existing getPackages apply block");
            if (!contents.includes("add(SharelPackage())")) {
              contents = contents.replace(
                /PackageList\(this\)\.getPackages\(\)\.apply\s*\{/g,
                "PackageList(this).getPackages().apply { add(SharelPackage());"
              );
              modified = true;
            }
          } else if (contents.includes("PackageList(this).getPackages()")) {
            console.log("[withHotspotNative] Found PackageList(this).getPackages() pattern");
            contents = contents.replace(
              /PackageList\(this\)\.getPackages\(\)(?!\.apply)/g,
              "PackageList(this).getPackages().apply { add(SharelPackage()) }"
            );
            modified = true;
          } else {
            console.log("[withHotspotNative] Looking for alternative patterns...");
            if (contents.includes("override val reactNativeHost")) {
              console.log("[withHotspotNative] Found reactNativeHost pattern");
              if (contents.includes("getPackages()") && !contents.includes("add(SharelPackage())")) {
                const packagesPattern = /(override\s+fun\s+getPackages\s*\(\s*\).*?)(PackageList\([^)]*\)\.[^}]+)/s;
                const match = contents.match(packagesPattern);
                if (match) {
                  console.log("[withHotspotNative] Found getPackages block, appending SharelPackage");
                  const newBlock = match[0].replace(
                    /(PackageList\([^)]*\)\.(packages|getPackages\(\)))/,
                    "$1.apply { add(SharelPackage()) }"
                  );
                  contents = contents.replace(match[0], newBlock);
                  modified = true;
                }
              }
            }
          }
          
          if (modified) {
            fs.writeFileSync(mainApplicationPath, contents);
            console.log("[withHotspotNative] MainApplication.kt modified successfully");
          }
        } else {
          console.log("[withHotspotNative] SharelPackage already present in MainApplication.kt");
        }
        
        contents = fs.readFileSync(mainApplicationPath, "utf-8");
        if (!contents.includes("LogModule.initializeGlobal")) {
          const onCreateMatch = contents.match(/(override\s+fun\s+onCreate\s*\(\s*\)\s*\{\s*\n?\s*super\.onCreate\s*\(\s*\))/);
          if (onCreateMatch) {
            contents = contents.replace(
              onCreateMatch[0],
              `${onCreateMatch[0]}\n        LogModule.initializeGlobal(this)`
            );
            fs.writeFileSync(mainApplicationPath, contents);
            console.log("[withHotspotNative] Added LogModule initialization to MainApplication.kt");
          } else {
            console.log("[withHotspotNative] Could not find onCreate pattern in MainApplication.kt");
          }
        }
        
        console.log("[withHotspotNative] Final MainApplication.kt content preview:", contents.substring(0, 800));
      } else {
        console.warn("[withHotspotNative] MainApplication.kt not found at:", mainApplicationPath);
      }
      
      return config;
    },
  ]);
  
  config = withAppBuildGradle(config, (config) => {
    let buildGradle = config.modResults.contents;
    
    const nanoHttpdDep = "implementation 'org.nanohttpd:nanohttpd:2.3.1'";
    if (!buildGradle.includes("nanohttpd")) {
      buildGradle = buildGradle.replace(
        /dependencies\s*\{/,
        `dependencies {\n    ${nanoHttpdDep}`
      );
      config.modResults.contents = buildGradle;
      console.log("[withHotspotNative] Added nanohttpd dependency to build.gradle");
    }
    
    return config;
  });
  
  return config;
}

module.exports = withHotspotNative;

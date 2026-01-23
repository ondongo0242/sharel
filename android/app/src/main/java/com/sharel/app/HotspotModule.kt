package com.sharel.app

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
            promise.reject("ERROR", "WiFi connection requires Android 10 or higher. Please connect manually to: $ssid")
            return
        }
        
        Thread {
            try {
                connectToWifiAndroid10Plus(ssid, password, ipAddress, port, promise)
            } catch (e: Exception) {
                mainHandler.post {
                    promise.reject("WIFI_ERROR", "Failed to connect: ${e.message}")
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
                        
                        val pingUrl = URL("http://$ipAddress:$port/join")
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
                                promise.reject("PING_ERROR", "Server responded with: $responseCode")
                            }
                        }
                    } catch (e: Exception) {
                        mainHandler.post {
                            val result = Arguments.createMap().apply {
                                putBoolean("connected", true)
                                putString("ssid", ssid)
                                putString("ipAddress", ipAddress)
                                putInt("port", port)
                                putString("warning", "Connected but ping failed: ${e.message}")
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
            promise.reject("ERROR", "Failed to disconnect: ${e.message}")
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
            promise.reject("PERMISSION_ERROR", "Location permission required: ${e.message}")
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to start hotspot: ${e.message}")
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
                        putString("ssid", wifiConfig?.SSID?.replace(""", "") ?: "SHAREL_Hotspot")
                        putString("password", wifiConfig?.preSharedKey?.replace(""", "") ?: "")
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
                    else -> "Unknown error: $reason"
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
            promise.reject("ERROR", "Failed to stop hotspot: ${e.message}")
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
                putString("ssid", wifiConfig?.SSID?.replace(""", "") ?: "")
                putString("password", wifiConfig?.preSharedKey?.replace(""", "") ?: "")
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

 }
    
    @ReactMethod
    fun addListener(eventName: String) {}
    
    @ReactMethod
    fun removeListeners(count: Int) {}
}

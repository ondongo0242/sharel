package com.sharel.app

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
                        else -> "Unknown error: $reason"
                    }
                    promise.reject("DISCOVER_FAILED", errorMsg)
                }
            })
        } catch (e: SecurityException) {
            promise.reject("PERMISSION_DENIED", "Location permission required: ${e.message}")
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
                    promise.reject("CONNECT_FAILED", "Connection failed: $reason")
                }
            })
        } catch (e: SecurityException) {
            promise.reject("PERMISSION_DENIED", "Permission required: ${e.message}")
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

package com.sharel.app

import android.content.ContentResolver
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import com.facebook.react.bridge.*
import java.util.concurrent.ConcurrentHashMap

class MediaGalleryModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val mediaCache = ConcurrentHashMap<String, WritableArray>()
    private val cacheTimestamps = ConcurrentHashMap<String, Long>()
    private val CACHE_VALIDITY_MS = 5 * 60 * 1000L // 5 minutes

    
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
            
            val sortOrder = "${MediaStore.MediaColumns.DATE_ADDED} DESC LIMIT $limit OFFSET $offset"
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
                        putString("uri", "file://$path")
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
                "${MediaStore.Images.Media.DATE_ADDED} DESC"
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
                    putString("thumbnailUri", "file://${pair.second}")
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
            
            val selection = "${MediaStore.Images.Media.BUCKET_ID} = ?"
            val selectionArgs = arrayOf(albumId)
            val sortOrder = "${MediaStore.Images.Media.DATE_ADDED} DESC LIMIT $limit OFFSET $offset"
            
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
                        putString("uri", "file://$path")
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

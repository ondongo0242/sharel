package com.sharel.app

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
            val selection = "${ContactsContract.Contacts.DISPLAY_NAME_PRIMARY} LIKE ?"
            val selectionArgs = arrayOf("%$query%")
            val contacts = fetchContactsWithSelection(selection, selectionArgs, limit)
            promise.resolve(contacts)
        } catch (e: Exception) {
            promise.reject("SEARCH_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun getContactById(contactId: String, promise: Promise) {
        try {
            val selection = "${ContactsContract.Contacts._ID} = ?"
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
        val limitClause = if (limit > 0) " LIMIT $limit OFFSET $offset" else ""
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
            "${ContactsContract.Contacts.DISPLAY_NAME_PRIMARY} ASC LIMIT $limit OFFSET $offset"
        } else {
            "${ContactsContract.Contacts.DISPLAY_NAME_PRIMARY} ASC"
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
                        "${ContactsContract.CommonDataKinds.Phone.CONTACT_ID} = ?",
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
                    "${ContactsContract.CommonDataKinds.Email.CONTACT_ID} = ?",
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

import { NativeModules, Platform } from 'react-native';

const { ContactsModule } = NativeModules;

export interface PhoneNumber {
  number: string;
  type: string;
}

export interface Email {
  email: string;
  type: string;
}

export interface Contact {
  id: string;
  name: string;
  hasPhoneNumber: boolean;
  photoUri: string;
  thumbnailUri: string;
  phoneNumbers: PhoneNumber[];
  emails: Email[];
}

class NativeContactsService {
  isAvailable(): boolean {
    return Platform.OS === 'android' && !!ContactsModule;
  }

  async getContacts(limit: number = 100, offset: number = 0): Promise<Contact[]> {
    if (!this.isAvailable()) {
      return [];
    }
    return ContactsModule.getContacts(limit, offset);
  }

  async getAllContacts(): Promise<Contact[]> {
    if (!this.isAvailable()) {
      return [];
    }
    return ContactsModule.getAllContacts();
  }

  async getContactsCount(): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }
    return ContactsModule.getContactsCount();
  }

  async searchContacts(query: string, limit: number = 50): Promise<Contact[]> {
    if (!this.isAvailable()) {
      return [];
    }
    return ContactsModule.searchContacts(query, limit);
  }

  async getContactById(contactId: string): Promise<Contact | null> {
    if (!this.isAvailable()) {
      return null;
    }
    try {
      return await ContactsModule.getContactById(contactId);
    } catch {
      return null;
    }
  }
}

export const nativeContacts = new NativeContactsService();
export default nativeContacts;

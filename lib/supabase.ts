import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://tbccbzlogitiaeyqsgna.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiY2NiemxvZ2l0aWFleXFzZ25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNzk2OTIsImV4cCI6MjA3OTY1NTY5Mn0.-dVVvGKjj_DQWrd4rrH9rKaRKsZ-ZmHofFqnM238NoE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

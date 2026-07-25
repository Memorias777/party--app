import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 1. Jalamos la URL desde la configuración segura
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL; 

// 2. Jalamos la llave desde la configuración segura
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Esta es la parte que "exporta" la conexión para que tu app la use
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
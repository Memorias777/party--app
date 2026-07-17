import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 1. Pega tu URL aquí (asegúrate de dejar las comillas simples)
const supabaseUrl = 'https://aljiwhkypmyqsyytqhxt.supabase.co'; 

// 2. Pega tu Publishable Key aquí (asegúrate de dejar las comillas simples)
const supabaseAnonKey = 'sb_publishable_wOPVfmBpKJYjDk6CetaMOw_O5O-adKl';

// Esta es la parte que "exporta" la conexión para que tu app la use
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
import { DataLayer } from '../types';
import { localData } from './local';
import { supabase } from '../supabase';
import { createSupabaseData } from './supabaseData';

// Real backend when EXPO_PUBLIC_SUPABASE_URL/ANON_KEY are set, local demo data otherwise.
export const data: DataLayer = supabase ? createSupabaseData(supabase) : localData;

import { DataLayer } from '../types';
import { localData } from './local';

// Swap this for the Supabase implementation without touching any screen.
export const data: DataLayer = localData;

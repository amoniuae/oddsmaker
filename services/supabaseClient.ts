import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import { Database } from '../database.types';

// IMPORTANT: For this to be secure, you must enable Row Level Security (RLS) on your Supabase tables.
// The policies should ensure that users can only access their own data.
// This implementation uses an anonymous, locally-stored user ID.
// A full authentication system would be required for true user-specific data security.

let supabaseInstance: SupabaseClient<Database> | null = null;

// This function lazily initializes and returns the Supabase client.
// It's called only when a Supabase method is actually used.
const getClient = (): SupabaseClient<Database> => {
  if (supabaseInstance) {
    return supabaseInstance;
  }
  
  // The app's entry point (App.tsx) checks for these keys and shows an
  // overlay if they are missing. This code should not run if the keys are
  // absent, but we add a check for robustness.
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error('Supabase URL and Anon Key are required but were not found.');
  }

  supabaseInstance = createClient<Database>(config.supabaseUrl, config.supabaseAnonKey);
  return supabaseInstance;
};

// We export a proxy object that mimics the Supabase client's API.
// This defers the actual client creation until a method like `from()` is called,
// preventing the "supabaseUrl is required" error during initial module load.
export const supabase: Pick<SupabaseClient<Database>, 'from'> = {
  from<TableName extends string & keyof Database["public"]["Tables"]>(
    relation: TableName
  ) {
    return getClient().from(relation);
  },
  // If other top-level methods from the supabase client were used, they would be added here.
  // For this app, only `from` is used at the top level.
};
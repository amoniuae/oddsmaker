// IMPORTANT: Configuration for Telegram and Supabase.
//
// Telegram Setup:
// The bot token and channel ID appear to be set up.
// The telegramChannelUrl has been updated based on the private channel ID.
// If the link doesn't work, you may need to create a specific public invite link for your channel.
//
// Supabase Setup:
// Your Supabase URL and public 'anon' key are configured below.
// For security, ensure you have enabled Row Level Security (RLS) on your Supabase tables.

interface Config {
  telegramBotToken: string;
  telegramChannelId: string | number; // Can be string for public, number for private
  telegramChannelUrl: string; // The public-facing URL for your channel
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export const config: Config = {
  telegramBotToken: '7895826844:AAGvUUAlhkXAyQcZ2dYwgxAQ0mm1N9TNX7U',
  telegramChannelId: -1002814567195,
  telegramChannelUrl: 'https://t.me/c/2814567195',

  // Supabase credentials from environment variables
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
};
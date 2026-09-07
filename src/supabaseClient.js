import { createClient } from '@supabase/supabase-js';

// Usanidi wa Supabase kwa kutumia vitambulisho vyako
const supabaseUrl = 'https://idnpricbfgiwzifwlwii.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkbnByaWNiZmdpd3ppZndsd2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NjU0MDgsImV4cCI6MjA5MjQ0MTQwOH0.FItNI4jDuwShdpJGAOXnebMFO7Wd5RqsJp7gP7ZhMy4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


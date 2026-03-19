import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase project details
const SUPABASE_URL = 'https://nmiejmpbrbpexsbwlizb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5taWVqbXBicmJwZXhzYndsaXpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzcwNDQsImV4cCI6MjA4OTIxMzA0NH0.zCMsXVZ8I3Rv-gInFEpip3zPMzDnZUUSkg2ipPhEHZ4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL ?? 'https://ckyncyqsakqevzeqgwgv.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseKey) {
  throw new Error('SUPABASE_KEY is not set. Create a .env with SUPABASE_KEY=...');
}

export const supabase = createClient(supabaseUrl, supabaseKey);


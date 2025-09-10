import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL ?? 'https://ckyncyqsakqevzeqgwgv.supabase.co';
const cliKeyArg = process.argv[2];
const supabaseKey = process.env.SUPABASE_KEY ?? cliKeyArg;

if (!supabaseKey) {
  console.error('Provide anon key via SUPABASE_KEY env or: node scripts/test-supabase.mjs <ANON_KEY>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Connection/auth error:', error.message);
    process.exit(1);
  }
  console.log('Connection successful:', JSON.stringify(data));
}

main();


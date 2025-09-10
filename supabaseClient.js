import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL ?? 'https://ckyncyqsakqevzeqgwgv.supabase.co'
const supabaseAnonKey = process.env.SUPABASE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNreW5jeXFzYWtxZXZ6ZXFnd2d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NzE2MTUsImV4cCI6MjA3MTM0NzYxNX0.t32UWdoe6w9b-OYfxb_FcTWTwvGJP-uIndGATxWOowQ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)


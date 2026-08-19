import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://epsdcvpzuaypavujvujn.supabase.co'
const supabaseAnonKey = 'sb_publishable_bWtKH74sQDywWADrAyw5EA_j6VBLm6G'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
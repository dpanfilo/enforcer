import { createClient } from '@supabase/supabase-js'

export const otherSupabase = createClient(
  process.env.OTHER_SUPABASE_URL!,
  process.env.OTHER_SUPABASE_SERVICE_KEY!
)

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Proxy AI calls through the Edge Function so the Anthropic key stays server-side
export async function callAI(prompt, max_tokens = 1000) {
  const { data, error } = await supabase.functions.invoke('ai-generate', {
    body: { prompt, max_tokens },
  })
  if (error) throw error
  return data.text
}

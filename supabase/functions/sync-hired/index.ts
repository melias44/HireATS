import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
 
const APPS_SCRIPT_URL = Deno.env.get('HIRED_SHEET_URL') ?? ''
 
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
 
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
 
  try {
    const data = await req.json()
 
    if (!APPS_SCRIPT_URL) {
      throw new Error('HIRED_SHEET_URL secret is not set')
    }
 
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      redirect: 'follow',
    })
 
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Apps Script returned ${res.status}: ${text}`)
    }
 
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
 
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
 
const APPS_SCRIPT_URL    = Deno.env.get('HIRED_SHEET_URL') ?? ''
const SUPABASE_URL       = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
 
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
    if (!APPS_SCRIPT_URL) throw new Error('HIRED_SHEET_URL secret is not set')
 
    const payload: Record<string, unknown> = { ...data }
 
    // Fetch signed offer PDF from Supabase Storage if candidateId provided
    if (data.candidateId && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
 
      const { data: offer } = await supabase
        .from('offers')
        .select('signed_document_path, job_title')
        .eq('candidate_id', data.candidateId)
        .not('signed_document_path', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
 
      if (offer?.signed_document_path) {
        const { data: fileData } = await supabase.storage
          .from('signed-offers')
          .download(offer.signed_document_path)
 
        if (fileData) {
          const buffer = await fileData.arrayBuffer()
          const bytes = new Uint8Array(buffer)
          let binary = ''
          bytes.forEach(b => binary += String.fromCharCode(b))
          payload.pdfBase64 = btoa(binary)
          payload.pdfName   = `${data.name} — ${data.jobTitle} — Signed Offer.pdf`
        }
      }
    }
 
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    })
 
    if (!res.ok) throw new Error(`Apps Script returned ${res.status}`)
 
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
 
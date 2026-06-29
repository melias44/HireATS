// Supabase Edge Function — DocuSign Connect webhook
// Receives envelope status updates from DocuSign, updates offer status,
// and downloads + stores the signed document when an envelope is completed.
//
// Deploy: npx supabase functions deploy docusign-webhook --project-ref <ref>
//
// Configure in DocuSign:
//   apps-d.docusign.com → Settings → Connect → Add Configuration
//   URL: https://<project-ref>.supabase.co/functions/v1/docusign-webhook
//   Events: Envelope Completed, Envelope Declined, Envelope Voided
//   Data format: JSON

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ── RSA key helpers (same as docusign-send) ───────────────────────────────────

function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const cat = (...a: Uint8Array[]) => {
    const out = new Uint8Array(a.reduce((s, x) => s + x.length, 0))
    let i = 0; for (const x of a) { out.set(x, i); i += x.length } return out
  }
  const len = (n: number) => n < 128 ? new Uint8Array([n])
    : n < 256 ? new Uint8Array([0x81, n])
    : new Uint8Array([0x82, n >> 8 & 0xff, n & 0xff])
  const seq = (...parts: Uint8Array[]) => { const b = cat(...parts); return cat(new Uint8Array([0x30]), len(b.length), b) }
  const version   = new Uint8Array([0x02, 0x01, 0x00])
  const oid       = new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01])
  const nullBytes = new Uint8Array([0x05, 0x00])
  const algId     = seq(oid, nullBytes)
  const privKey   = cat(new Uint8Array([0x04]), len(pkcs1.length), pkcs1)
  return seq(version, algId, privKey)
}

function b64url(input: string | ArrayBuffer): string {
  const str = typeof input === 'string'
    ? btoa(input)
    : btoa(String.fromCharCode(...new Uint8Array(input)))
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function getAccessToken(): Promise<string> {
  const integrationKey = Deno.env.get("DOCUSIGN_INTEGRATION_KEY")!
  const userId         = Deno.env.get("DOCUSIGN_USER_ID")!
  const privateKeyPem  = Deno.env.get("DOCUSIGN_PRIVATE_KEY")!
  const basePath       = Deno.env.get("DOCUSIGN_BASE_PATH") || "https://demo.docusign.net/restapi"
  const authHost       = basePath.includes("demo") ? "account-d.docusign.com" : "account.docusign.com"

  const normalizedPem = privateKeyPem.replace(/\\n/g, '\n')
  const pemBody = normalizedPem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
  const derBytes = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))

  let cryptoKey: CryptoKey
  try {
    cryptoKey = await crypto.subtle.importKey("pkcs8", derBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"])
  } catch {
    cryptoKey = await crypto.subtle.importKey("pkcs8", pkcs1ToPkcs8(derBytes), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"])
  }

  const now     = Math.floor(Date.now() / 1000)
  const header  = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const payload = b64url(JSON.stringify({ iss: integrationKey, sub: userId, aud: authHost, iat: now, exp: now + 3600, scope: "signature impersonation" }))
  const sig     = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(`${header}.${payload}`))
  const jwt     = `${header}.${payload}.${b64url(sig)}`

  const res = await fetch(`https://${authHost}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  if (!res.ok) throw new Error(`DocuSign auth failed: ${await res.text()}`)
  return (await res.json()).access_token
}

// ── Webhook handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  // Always return 200 to DocuSign — if we return anything else, it will retry endlessly
  if (req.method === "OPTIONS") return new Response("ok", { status: 200 })

  try {
    const payload = await req.json()

    // DocuSign Connect JSON payload structure
    const envelopeId = payload.data?.envelopeId
    const status     = payload.data?.envelopeSummary?.status || payload.event

    if (!envelopeId) return new Response("ok", { status: 200 })

    console.log(`Webhook: envelopeId=${envelopeId} status=${status}`)

    // Use service role key to bypass RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Find matching offer
    const { data: offer } = await supabase
      .from('offers')
      .select('*')
      .eq('docusign_envelope_id', envelopeId)
      .maybeSingle()

    if (!offer) {
      console.log("No offer found for envelope", envelopeId)
      return new Response("ok", { status: 200 })
    }

    // Map DocuSign status → our fields
    const updates: Record<string, unknown> = {
      docusign_status: status,
    }

    if (status === 'completed') {
      updates.status   = 'Accepted'
      updates.signed_at = new Date().toISOString()

      // Download the signed combined PDF
      try {
        const token      = await getAccessToken()
        const accountId  = Deno.env.get("DOCUSIGN_ACCOUNT_ID")!
        const basePath   = Deno.env.get("DOCUSIGN_BASE_PATH") || "https://demo.docusign.net/restapi"

        const docRes = await fetch(
          `${basePath}/v2.1/accounts/${accountId}/envelopes/${envelopeId}/documents/combined`,
          { headers: { "Authorization": `Bearer ${token}`, "Accept": "application/pdf" } }
        )

        if (docRes.ok) {
          const pdfBytes = await docRes.arrayBuffer()
          const path     = `signed-offers/${offer.id}.pdf`

          const { error: uploadErr } = await supabase.storage
            .from('signed-offers')
            .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: true })

          if (!uploadErr) {
            updates.signed_document_path = path
            console.log("Signed doc saved:", path)
          } else {
            console.error("Upload error:", uploadErr)
          }
        } else {
          console.error("DocuSign doc download failed:", await docRes.text())
        }
      } catch (e) {
        console.error("Signed doc download error:", e)
        // Don't fail the whole webhook over this
      }

    } else if (status === 'declined') {
      updates.status = 'Declined'
    }

    await supabase.from('offers').update(updates).eq('id', offer.id)
    console.log("Offer updated:", offer.id, updates)

  } catch (err) {
    console.error("Webhook error:", err)
  }

  // Always 200 so DocuSign doesn't retry
  return new Response("ok", { status: 200 })
})

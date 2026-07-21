// Supabase Edge Function — fills placeholders in a Word template, then sends via DocuSign
// Deploy: supabase functions deploy docusign-send
//
// Placeholders to use in your Word template (plain text, not bold):
//   {candidate_name}  {job_title}  {salary_amount}  {anticipated_start_date}
//   {today_date}  {custom_manager_title}  {custom_commission_amount}
//   {offer_expiration_date}  {offered_annual_bonus}
//
// Secrets needed:
//   supabase secrets set DOCUSIGN_INTEGRATION_KEY=...
//   supabase secrets set DOCUSIGN_USER_ID=...
//   supabase secrets set DOCUSIGN_PRIVATE_KEY="$(cat docusign_private.pem)"
//   supabase secrets set DOCUSIGN_ACCOUNT_ID=...
//   supabase secrets set DOCUSIGN_BASE_PATH=https://demo.docusign.net/restapi
 
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// deno-lint-ignore-file no-explicit-any
import PizZip from "npm:pizzip@3.1.6"
import Docxtemplater from "npm:docxtemplater@3.46.0"
 
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}
 
// Fill {placeholder} tags in a DOCX file using docxtemplater.
// This correctly handles placeholders that Word has split across multiple XML runs,
// preserves all formatting for non-placeholder text, and avoids the XML-leaking
// bug that the manual regex approach had.
function fillDocxTemplate(base64: string, subs: Record<string, string>): string {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
 
  const zip = new PizZip(bytes)
 
  const doc = new (Docxtemplater as any)(zip, {
    delimiters: { start: '{', end: '}' },
    linebreaks: true,
    // Return empty string for any placeholder not found in subs
    nullGetter: (part: { value: string }) => {
      console.log(`Placeholder not found: ${part.value}`)
      return ''
    },
  })
 
  doc.render(subs)
 
  const output = doc.getZip().generate({ type: 'uint8array' })
  let result = ''
  output.forEach((b: number) => result += String.fromCharCode(b))
  return btoa(result)
}
 
// Convert PKCS#1 RSA private key DER → PKCS#8 DER (Web Crypto requires PKCS#8)
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
 
// ── DocuSign JWT Bearer auth ─────────────────────────────────────────────────
function b64url(input: string | ArrayBuffer): string {
  const str = typeof input === 'string'
    ? btoa(input)
    : btoa(String.fromCharCode(...new Uint8Array(input)))
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
 
async function getAccessToken(): Promise<string> {
  const integrationKey = Deno.env.get("DOCUSIGN_INTEGRATION_KEY")
  const userId        = Deno.env.get("DOCUSIGN_USER_ID")
  const privateKeyPem = Deno.env.get("DOCUSIGN_PRIVATE_KEY")
  const basePath      = Deno.env.get("DOCUSIGN_BASE_PATH") || "https://demo.docusign.net/restapi"
  const authHost      = basePath.includes("demo") ? "account-d.docusign.com" : "account.docusign.com"
 
  if (!integrationKey) throw new Error("Missing secret: DOCUSIGN_INTEGRATION_KEY")
  if (!userId)         throw new Error("Missing secret: DOCUSIGN_USER_ID — find your API Username on the DocuSign Apps & Keys page")
  if (!privateKeyPem)  throw new Error("Missing secret: DOCUSIGN_PRIVATE_KEY — run: npx supabase secrets set DOCUSIGN_PRIVATE_KEY=\"$(cat docusign_private.pem)\"")
 
  const normalizedPem = privateKeyPem.replace(/\\n/g, '\n')
  const pemBody = normalizedPem
    .replace(/-----[^-]+-----/g, '')
    .replace(/\s/g, '')
  const derBytes = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))
 
  const keyDiag = `header="${normalizedPem.split('\n')[0]}" pemLen=${normalizedPem.length} b64Len=${pemBody.length} derLen=${derBytes.length} firstByte=0x${derBytes[0]?.toString(16)}`
 
  let cryptoKey: CryptoKey
  try {
    cryptoKey = await crypto.subtle.importKey(
      "pkcs8", derBytes,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false, ["sign"]
    )
  } catch (e1) {
    try {
      cryptoKey = await crypto.subtle.importKey(
        "pkcs8", pkcs1ToPkcs8(derBytes),
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false, ["sign"]
      )
    } catch (e2) {
      throw new Error(`Key import failed [${keyDiag}] pkcs8err=${e1} pkcs1err=${e2}`)
    }
  }
 
  const now = Math.floor(Date.now() / 1000)
  const header  = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const payload = b64url(JSON.stringify({
    iss: integrationKey,
    sub: userId,
    aud: authHost,
    iat: now,
    exp: now + 3600,
    scope: "signature impersonation",
  }))
  const sigInput  = `${header}.${payload}`
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(sigInput)
  )
  const jwt = `${sigInput}.${b64url(signature)}`
 
  const res = await fetch(`https://${authHost}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
 
  if (!res.ok) {
    const err = await res.text()
    if (err.includes("consent_required")) {
      throw new Error(
        `DocuSign consent required — visit this URL once in a browser to grant access:\n` +
        `https://${authHost}/oauth/auth?response_type=code&scope=signature%20impersonation` +
        `&client_id=${integrationKey}&redirect_uri=https://developers.docusign.com/platform/auth/consent`
      )
    }
    throw new Error(`DocuSign JWT auth failed: ${err}`)
  }
 
  return (await res.json()).access_token
}
 
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
 
  try {
    const {
      signerEmail,
      signerName,
      documentBase64,
      documentName,
      emailSubject,
      emailBlurb,
      substitutions,
      previewOnly,
    } = await req.json()
 
    if (!documentBase64) {
      return new Response(JSON.stringify({ error: "documentBase64 is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
 
    const ext = documentName?.split('.').pop()?.toLowerCase() || 'docx'
    const isDocx = ext === 'docx' || ext === 'doc'
 
    let finalBase64 = documentBase64
    if (isDocx && substitutions) {
      try {
        finalBase64 = fillDocxTemplate(documentBase64, substitutions)
      } catch (e) {
        console.error("Template fill error (sending original):", e)
        finalBase64 = documentBase64
      }
    }
 
    if (previewOnly) {
      return new Response(JSON.stringify({ documentBase64: finalBase64, documentName }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
 
    if (!signerEmail || !signerName) {
      return new Response(JSON.stringify({ error: "signerEmail and signerName are required to send" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
 
    const accountId = Deno.env.get("DOCUSIGN_ACCOUNT_ID")
    if (!accountId) throw new Error("Missing secret: DOCUSIGN_ACCOUNT_ID")
    const basePath = Deno.env.get("DOCUSIGN_BASE_PATH") || "https://demo.docusign.net/restapi"
    const token = await getAccessToken()
 
    const envelope = {
      emailSubject: emailSubject || "Please sign your offer letter",
      emailBlurb:   emailBlurb   || "Please review and sign your offer letter.",
      documents: [{
        documentBase64: finalBase64,
        name:           documentName || "Offer Letter.docx",
        fileExtension:  ext,
        documentId:     "1",
      }],
      recipients: {
        signers: [{
          email:       signerEmail,
          name:        signerName,
          recipientId: "1",
          routingOrder: "1",
          tabs: {
            signHereTabs: [{
              anchorString:            "{candidate_signature}",
              anchorXOffset:           "0",
              anchorYOffset:           "0",
              anchorIgnoreIfNotPresent: "true",
              pageNumber:              "1",
              xPosition:               "100",
              yPosition:               "700",
            }],
          },
        }],
      },
      status: "sent",
    }
 
    const response = await fetch(`${basePath}/v2.1/accounts/${accountId}/envelopes`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(envelope),
    })
 
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || JSON.stringify(result))
 
    return new Response(JSON.stringify({ envelopeId: result.envelopeId, status: result.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("docusign-send error:", String(err))
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
 
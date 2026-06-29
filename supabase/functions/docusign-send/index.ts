// Supabase Edge Function — fills placeholders in a Word template, then sends via DocuSign
// Deploy: supabase functions deploy docusign-send
//
// Placeholders to use in your Word template:
//   {{CANDIDATE_NAME}}  {{ROLE}}  {{SALARY}}  {{START_DATE}}  {{TODAY}}  {{COMPANY}}
//
// Secrets needed:
//   supabase secrets set DOCUSIGN_INTEGRATION_KEY=...
//   supabase secrets set DOCUSIGN_SECRET_KEY=...
//   supabase secrets set DOCUSIGN_ACCOUNT_ID=...
//   supabase secrets set DOCUSIGN_BASE_PATH=https://demo.docusign.net/restapi

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { unzipSync, zipSync, strFromU8, strToU8 } from "npm:fflate@0.8.2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Fill {placeholder} tags in a DOCX file.
//
// Two-pass strategy:
//   Pass 1 — direct string replacement. This handles placeholders that live entirely
//             within a single <w:t> tag and preserves ALL run/paragraph formatting.
//   Pass 2 — paragraph-level collapse, only for any placeholders that Word split
//             across multiple runs (and therefore survived pass 1).
//             Only those specific paragraphs get rebuilt; everything else is untouched.
function fillDocxTemplate(base64: string, subs: Record<string, string>): string {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

  const unzipped = unzipSync(bytes)
  const xmlFiles = Object.keys(unzipped).filter(f => f.startsWith('word/') && f.endsWith('.xml'))

  for (const file of xmlFiles) {
    let xml = strFromU8(unzipped[file])

    // ── Pass 1: direct replacement (preserves all formatting) ──────────────
    for (const [key, value] of Object.entries(subs)) {
      xml = xml.split(`{${key}}`).join(escapeXml(value))
    }

    // ── Pass 2: collapse split-run placeholders ─────────────────────────────
    // Only runs if there's still a '{' left in the XML (means at least one placeholder
    // is split across runs). We only rebuild paragraphs that actually need it.
    if (xml.includes('{')) {
      xml = xml.replace(/<w:p\b([^>]*)>([\s\S]*?)<\/w:p>/g, (fullPara, pAttrs, content) => {
        // Collect all text across every <w:t> in this paragraph
        const allText = [...content.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
          .map(m => m[1])
          .join('')

        // Any remaining placeholders in this paragraph?
        let newText = allText
        let changed = false
        for (const [key, value] of Object.entries(subs)) {
          if (newText.includes(`{${key}}`)) {
            newText = newText.split(`{${key}}`).join(value)
            changed = true
          }
        }
        if (!changed) return fullPara   // nothing to do — return original XML untouched

        // Grab full paragraph properties.
        // Greedy ([\s\S]*) so nested <w:pPr> inside <w:pPrChange> is included in full —
        // the lazy version stops at the inner </w:pPr> and leaves dangling XML as visible text.
        const pPrMatch = content.match(/<w:pPr\b[^>]*>[\s\S]*<\/w:pPr>/)
        const pPr = pPrMatch ? pPrMatch[0] : ''

        // Get run properties from the FIRST ACTUAL RUN after the pPr block.
        // (pPr can contain its own <w:rPr> for the paragraph mark — we must not use that
        //  or we'll apply paragraph-mark formatting like bold to the new run.)
        const afterPPr = pPr ? content.slice(content.indexOf(pPr) + pPr.length) : content
        const firstRun = afterPPr.match(/<w:r\b[^>]*>([\s\S]*?)<\/w:r>/)
        const rPrInRun = firstRun
          ? firstRun[1].match(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/)
          : null
        const rPr = rPrInRun ? rPrInRun[0] : ''

        return `<w:p${pAttrs}>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(newText)}</w:t></w:r></w:p>`
      })
    }

    unzipped[file] = strToU8(xml)
  }

  const zipped = zipSync(unzipped)
  let result = ''
  zipped.forEach(b => result += String.fromCharCode(b))
  return btoa(result)
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
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
// DocuSign doesn't support client_credentials. Server-to-server requires JWT.
// Setup: generate RSA keypair, add public key to DocuSign Apps & Keys, then:
//   npx supabase secrets set DOCUSIGN_USER_ID=<api-username-guid> DOCUSIGN_PRIVATE_KEY="$(cat private.pem)"

function b64url(input: string | ArrayBuffer): string {
  const str = typeof input === 'string'
    ? btoa(input)
    : btoa(String.fromCharCode(...new Uint8Array(input)))
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function getAccessToken(): Promise<string> {
  const integrationKey = Deno.env.get("DOCUSIGN_INTEGRATION_KEY")
  const userId       = Deno.env.get("DOCUSIGN_USER_ID")
  const privateKeyPem = Deno.env.get("DOCUSIGN_PRIVATE_KEY")
  const basePath     = Deno.env.get("DOCUSIGN_BASE_PATH") || "https://demo.docusign.net/restapi"
  const authHost     = basePath.includes("demo") ? "account-d.docusign.com" : "account.docusign.com"

  if (!integrationKey) throw new Error("Missing secret: DOCUSIGN_INTEGRATION_KEY")
  if (!userId)         throw new Error("Missing secret: DOCUSIGN_USER_ID — find your API Username on the DocuSign Apps & Keys page")
  if (!privateKeyPem)  throw new Error("Missing secret: DOCUSIGN_PRIVATE_KEY — run: npx supabase secrets set DOCUSIGN_PRIVATE_KEY=\"$(cat docusign_private.pem)\"")

  // Import RSA private key — handles both PKCS#1 (BEGIN RSA PRIVATE KEY)
  // and PKCS#8 (BEGIN PRIVATE KEY). DocuSign generates PKCS#1; Web Crypto needs PKCS#8.
  const pemBody = privateKeyPem
    .replace(/-----[^-]+-----/g, '')
    .replace(/\s/g, '')
  let derBytes = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))

  if (privateKeyPem.includes("BEGIN RSA PRIVATE KEY")) {
    derBytes = pkcs1ToPkcs8(derBytes)
  }

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    derBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  )

  // Build JWT
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

  // Exchange for access token
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
      previewOnly,     // if true, return filled doc without sending to DocuSign
    } = await req.json()

    if (!documentBase64) {
      return new Response(JSON.stringify({ error: "documentBase64 is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const ext = documentName?.split('.').pop()?.toLowerCase() || 'docx'
    const isDocx = ext === 'docx' || ext === 'doc'

    // Fill placeholders if it's a Word doc and substitutions were provided
    let finalBase64 = documentBase64
    if (isDocx && substitutions) {
      try {
        finalBase64 = fillDocxTemplate(documentBase64, substitutions)
      } catch (e) {
        console.error("Template fill error (sending original):", e)
        finalBase64 = documentBase64
      }
    }

    // Preview mode — return filled document without sending
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
    if (!accountId) throw new Error("Missing secret: DOCUSIGN_ACCOUNT_ID — set it with: npx supabase secrets set DOCUSIGN_ACCOUNT_ID=... --project-ref <ref>")
    const basePath = Deno.env.get("DOCUSIGN_BASE_PATH") || "https://demo.docusign.net/restapi"
    const token = await getAccessToken()

    const envelope = {
      emailSubject: emailSubject || "Please sign your offer letter",
      emailBlurb: emailBlurb || "Please review and sign your offer letter.",
      documents: [{
        documentBase64: finalBase64,
        name: documentName || "Offer Letter.docx",
        fileExtension: ext,
        documentId: "1",
      }],
      recipients: {
        signers: [{
          email: signerEmail,
          name: signerName,
          recipientId: "1",
          routingOrder: "1",
          tabs: {
            signHereTabs: [{
              anchorString: "{candidate_signature}",
              anchorXOffset: "0",
              anchorYOffset: "0",
              anchorIgnoreIfNotPresent: "true",
              pageNumber: "1",
              xPosition: "100",
              yPosition: "700",
            }],
          },
        }],
      },
      status: "sent",
    }

    const response = await fetch(`${basePath}/v2.1/accounts/${accountId}/envelopes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
    // Return 200 so the Supabase client doesn't swallow the body — error is in the payload
    console.error("docusign-send error:", String(err))
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

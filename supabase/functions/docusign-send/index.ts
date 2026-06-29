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

// Fill {placeholder} tags in a DOCX file
// Works by processing each paragraph as a unit — extracts all text, applies substitutions,
// then rebuilds the paragraph. Handles Word's habit of splitting text across multiple runs.
function fillDocxTemplate(base64: string, subs: Record<string, string>): string {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

  const unzipped = unzipSync(bytes)
  const xmlFiles = Object.keys(unzipped).filter(f => f.startsWith('word/') && f.endsWith('.xml'))

  for (const file of xmlFiles) {
    let xml = strFromU8(unzipped[file])

    // Process each paragraph independently
    xml = xml.replace(/<w:p\b([^>]*)>([\s\S]*?)<\/w:p>/g, (fullPara, pAttrs, content) => {
      // Grab paragraph-level properties (indents, spacing, style)
      const pPrMatch = content.match(/<w:pPr[\s\S]*?<\/w:pPr>/)
      const pPr = pPrMatch ? pPrMatch[0] : ''

      // Grab run-level properties from the first run (bold, italic, font, size)
      const rPrMatch = content.match(/<w:rPr[\s\S]*?<\/w:rPr>/)
      const rPr = rPrMatch ? rPrMatch[0] : ''

      // Collect all text across every <w:t> in this paragraph
      const allText = [...content.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
        .map(m => m[1])
        .join('')

      // Apply all substitutions to the combined text
      let newText = allText
      let changed = false
      for (const [key, value] of Object.entries(subs)) {
        const ph = `{${key}}`
        if (newText.includes(ph)) {
          newText = newText.split(ph).join(value)
          changed = true
        }
      }

      if (!changed) return fullPara

      // Rebuild: one run with the substituted text, preserving paragraph + run formatting
      return `<w:p${pAttrs}>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(newText)}</w:t></w:r></w:p>`
    })

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

async function getAccessToken(): Promise<string> {
  const integrationKey = Deno.env.get("DOCUSIGN_INTEGRATION_KEY")!
  const secretKey = Deno.env.get("DOCUSIGN_SECRET_KEY")!

  const res = await fetch("https://account-d.docusign.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + btoa(`${integrationKey}:${secretKey}`),
    },
    body: "grant_type=client_credentials&scope=signature%20impersonation",
  })

  if (!res.ok) {
    const res2 = await fetch("https://account.docusign.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + btoa(`${integrationKey}:${secretKey}`),
      },
      body: "grant_type=client_credentials&scope=signature",
    })
    if (!res2.ok) throw new Error(`DocuSign auth failed: ${await res2.text()}`)
    return (await res2.json()).access_token
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

    const accountId = Deno.env.get("DOCUSIGN_ACCOUNT_ID")!
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
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

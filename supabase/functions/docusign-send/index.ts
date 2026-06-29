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

// Replace {{PLACEHOLDER}} tags in a DOCX file's XML
function fillDocxTemplate(base64: string, subs: Record<string, string>): string {
  // Decode base64 → bytes
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

  // Unzip the DOCX (it's a ZIP)
  const unzipped = unzipSync(bytes)

  // Files to process (main doc + headers/footers)
  const xmlFiles = Object.keys(unzipped).filter(
    f => f.startsWith('word/') && f.endsWith('.xml')
  )

  for (const file of xmlFiles) {
    let xml = strFromU8(unzipped[file])

    // Step 1: collapse split placeholder runs
    // Word sometimes splits {{PLACEHOLDER}} across multiple <w:r> runs — join them first
    xml = collapseRuns(xml)

    // Step 2: replace each placeholder
    for (const [key, value] of Object.entries(subs)) {
      const escaped = escapeXml(value)
      xml = xml.split(`{{${key}}}`).join(escaped)
    }

    unzipped[file] = strToU8(xml)
  }

  // Rezip and encode back to base64
  const zipped = zipSync(unzipped)
  let result = ''
  zipped.forEach(b => result += String.fromCharCode(b))
  return btoa(result)
}

// Collapse adjacent <w:r> runs that together form a placeholder
// so {{PLACEHOLDER}} isn't split like {{PLACE | HOLDER}}
function collapseRuns(xml: string): string {
  // Extract all text content from runs in a paragraph, check if combined they contain a placeholder,
  // and if so rebuild a single run with the combined text
  return xml.replace(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g, (paraMatch) => {
    // Get all run texts in order
    const runPattern = /(<w:r\b[^>]*>)([\s\S]*?)(<\/w:r>)/g
    const texts: string[] = []
    let m
    while ((m = runPattern.exec(paraMatch)) !== null) {
      const inner = m[2]
      const textMatch = inner.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/)
      texts.push(textMatch ? textMatch[1] : '')
    }
    const combined = texts.join('')
    // Only bother rewriting if it looks like there might be a split placeholder
    if (!combined.includes('{{')) return paraMatch

    // Rebuild: replace all runs with a single run containing combined text, preserving first run's props
    const firstRunProps = paraMatch.match(/<w:r\b[^>]*>([\s\S]*?)<w:t/)
    const rPr = firstRunProps ? (firstRunProps[1].match(/<w:rPr[\s\S]*?<\/w:rPr>/) || [''])[0] : ''
    const newRun = `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(combined)}</w:t></w:r>`
    // Replace all runs in the paragraph with one combined run
    return paraMatch.replace(/(<w:r\b[^>]*>[\s\S]*?<\/w:r>)+/, newRun)
  })
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
      substitutions,   // { CANDIDATE_NAME, ROLE, SALARY, START_DATE, TODAY, COMPANY }
    } = await req.json()

    if (!signerEmail || !signerName || !documentBase64) {
      return new Response(JSON.stringify({ error: "signerEmail, signerName, and documentBase64 are required" }), {
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
        // Fall back to original if fill fails
        finalBase64 = documentBase64
      }
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
              anchorString: "/sig1/",
              anchorXOffset: "0",
              anchorYOffset: "0",
              anchorIgnoreIfNotPresent: "true",
              pageNumber: "1",
              xPosition: "100",
              yPosition: "700",
            }],
            dateSignedTabs: [{
              anchorString: "/date1/",
              anchorIgnoreIfNotPresent: "true",
              pageNumber: "1",
              xPosition: "300",
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

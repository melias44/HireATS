// Supabase Edge Function — sends a DocuSign envelope from a filled Word template
// Deploy: supabase functions deploy docusign-send
// Secrets needed:
//   supabase secrets set DOCUSIGN_INTEGRATION_KEY=your-integration-key
//   supabase secrets set DOCUSIGN_SECRET_KEY=your-secret-key
//   supabase secrets set DOCUSIGN_ACCOUNT_ID=your-account-id
//   supabase secrets set DOCUSIGN_BASE_PATH=https://demo.docusign.net/restapi   (use https://na4.docusign.net/restapi for production)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Get DocuSign access token via JWT or Client Credentials
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
    // Try the production auth endpoint
    const res2 = await fetch("https://account.docusign.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + btoa(`${integrationKey}:${secretKey}`),
      },
      body: "grant_type=client_credentials&scope=signature",
    })
    if (!res2.ok) {
      const err = await res2.text()
      throw new Error(`DocuSign auth failed: ${err}`)
    }
    const data2 = await res2.json()
    return data2.access_token
  }

  const data = await res.json()
  return data.access_token
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const {
      signerEmail,
      signerName,
      documentBase64,  // base64-encoded Word/PDF document
      documentName,    // e.g. "Offer Letter - Jordan Lee.docx"
      emailSubject,    // e.g. "Your offer from BDG"
      emailBlurb,      // short message in the email body
    } = await req.json()

    if (!signerEmail || !signerName || !documentBase64) {
      return new Response(JSON.stringify({ error: "signerEmail, signerName, and documentBase64 are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const accountId = Deno.env.get("DOCUSIGN_ACCOUNT_ID")!
    const basePath = Deno.env.get("DOCUSIGN_BASE_PATH") || "https://demo.docusign.net/restapi"
    const token = await getAccessToken()

    // Determine file extension for DocuSign fileExtension field
    const ext = documentName?.split('.').pop()?.toLowerCase() || 'docx'
    const mimeType = ext === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

    const envelope = {
      emailSubject: emailSubject || "Please sign your offer letter",
      emailBlurb: emailBlurb || "Please review and sign your offer letter at your earliest convenience.",
      documents: [
        {
          documentBase64,
          name: documentName || "Offer Letter.docx",
          fileExtension: ext,
          documentId: "1",
        },
      ],
      recipients: {
        signers: [
          {
            email: signerEmail,
            name: signerName,
            recipientId: "1",
            routingOrder: "1",
            tabs: {
              signHereTabs: [
                {
                  // Place signature at the bottom of the last page
                  anchorString: "/sig1/",
                  anchorXOffset: "0",
                  anchorYOffset: "0",
                  anchorIgnoreIfNotPresent: "true",
                  // Fallback: absolute position on page 1
                  pageNumber: "1",
                  xPosition: "100",
                  yPosition: "700",
                },
              ],
              dateSignedTabs: [
                {
                  anchorString: "/date1/",
                  anchorIgnoreIfNotPresent: "true",
                  pageNumber: "1",
                  xPosition: "300",
                  yPosition: "700",
                },
              ],
            },
          },
        ],
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

    if (!response.ok) {
      throw new Error(result.message || JSON.stringify(result))
    }

    return new Response(JSON.stringify({ envelopeId: result.envelopeId, status: result.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

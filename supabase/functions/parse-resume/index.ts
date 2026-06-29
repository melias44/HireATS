// Supabase Edge Function — parses a resume file and extracts candidate info
// Deploy: supabase functions deploy parse-resume
// Uses the same ANTHROPIC_API_KEY secret as ai-generate

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { fileBase64, fileType } = await req.json()

    if (!fileBase64) {
      return new Response(JSON.stringify({ error: "fileBase64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const isPdf = fileType === "application/pdf"

    let messages: any[]

    if (isPdf) {
      // Use Claude's native PDF support
      messages = [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: fileBase64,
              },
            },
            {
              type: "text",
              text: `Extract the following information from this resume and return it as JSON only (no markdown, no explanation):
{
  "fname": "first name",
  "lname": "last name",
  "email": "email address or empty string",
  "phone": "phone number or empty string",
  "linkedin": "linkedin URL or empty string",
  "location": "city, state or empty string",
  "experience": "2-3 sentence summary of their background and most recent roles",
  "source": "LinkedIn"
}
If you cannot find a field, use an empty string. Always return valid JSON.`,
            },
          ],
        },
      ]
    } else {
      // For Word docs, treat as text-based and extract what we can
      messages = [
        {
          role: "user",
          content: `I'm going to give you base64-encoded content from a Word document resume. Please extract candidate information and return JSON only (no markdown, no explanation):
{
  "fname": "first name",
  "lname": "last name",
  "email": "email address or empty string",
  "phone": "phone number or empty string",
  "linkedin": "linkedin URL or empty string",
  "location": "city, state or empty string",
  "experience": "2-3 sentence summary of their background and most recent roles",
  "source": "LinkedIn"
}

Note: This is a Word document. Do your best to extract text from the base64 content. If you cannot parse it, return the JSON with empty strings and experience set to "Please review the uploaded resume manually."

Base64 content (first 2000 chars): ${fileBase64.substring(0, 2000)}

Return only valid JSON.`,
        },
      ]
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 1000,
        messages,
      }),
    })

    const data = await response.json()
    const text = data.content?.[0]?.text ?? "{}"

    // Parse the JSON response
    let parsed
    try {
      // Strip any markdown code blocks if present
      const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      parsed = JSON.parse(clean)
    } catch {
      parsed = {
        fname: "", lname: "", email: "", phone: "",
        linkedin: "", location: "",
        experience: "Could not parse resume automatically. Please fill in details manually.",
        source: "Other",
      }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

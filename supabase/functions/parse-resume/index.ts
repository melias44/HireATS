import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Extract readable text from a PDF binary
function extractPdfText(bytes: Uint8Array): string {
  const str = new TextDecoder("latin1").decode(bytes)
  const texts: string[] = []

  // Pull text from BT...ET blocks (standard PDF text objects)
  for (const block of str.matchAll(/BT([\s\S]*?)ET/g)) {
    const content = block[1]
    // Tj — single string: (text) Tj
    for (const m of content.matchAll(/\(([^)\\]|\\[\s\S])*\)\s*Tj/g)) {
      const raw = m[0].slice(1, m[0].lastIndexOf(")"))
        .replace(/\\n/g, " ").replace(/\\r/g, " ").replace(/\\t/g, " ")
        .replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\")
      if (raw.trim()) texts.push(raw.trim())
    }
    // TJ — array of strings: [(text)(text)] TJ
    for (const arr of content.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      const parts: string[] = []
      for (const s of arr[1].matchAll(/\(([^)]*)\)/g)) {
        parts.push(s[1])
      }
      if (parts.length) texts.push(parts.join(""))
    }
  }

  if (texts.length > 0) {
    return texts.join(" ").replace(/\s+/g, " ").trim().substring(0, 7000)
  }

  // Fallback: grab lines that look like readable text
  const lines = str
    .split(/[\r\n]+/)
    .map(l => l.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim())
    .filter(l => l.length > 4 && /[a-zA-Z]{3,}/.test(l))
  return lines.join("\n").substring(0, 7000)
}

// Extract readable text from a DOCX (which is a ZIP with XML inside)
function extractDocxText(bytes: Uint8Array): string {
  // Decode as UTF-8 with replacement so we don't throw on binary
  const str = new TextDecoder("utf-8", { fatal: false }).decode(bytes)
  // Strip XML tags and decode basic entities
  return str
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 7000)
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { fileBase64, fileType } = await req.json()

    if (!fileBase64) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Decode base64 → bytes
    const binaryStr = atob(fileBase64)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }

    // Extract text
    const isPdf = fileType === "application/pdf"
    const resumeText = isPdf ? extractPdfText(bytes) : extractDocxText(bytes)

    console.log("Extracted text length:", resumeText.length)
    console.log("Extracted text preview:", resumeText.substring(0, 200))

    if (resumeText.length < 30) {
      return new Response(JSON.stringify({
        fname: "", lname: "", email: "", phone: "",
        linkedin: "", location: "",
        experience: "Could not extract text from resume. Please fill in fields manually.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{
          role: "user",
          content: `Extract candidate information from the resume text below. Return ONLY a raw JSON object — no markdown, no code blocks, no explanation.

Format:
{"fname":"","lname":"","email":"","phone":"","linkedin":"","location":"","experience":""}

Rules:
- fname / lname: first and last name
- email: email address or empty string
- phone: phone number or empty string
- linkedin: LinkedIn URL or empty string
- location: city, state or empty string
- experience: 2-3 sentence summary of their background and most recent role
- Use empty string for anything not found

Resume text:
${resumeText}`,
        }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error("Anthropic API error:", response.status, errText)
      throw new Error(`Anthropic API returned ${response.status}: ${errText}`)
    }

    const apiData = await response.json()
    const rawText = apiData.content?.[0]?.text ?? "{}"
    console.log("Claude response:", rawText)

    let parsed
    try {
      const match = rawText.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(match ? match[0] : rawText)
    } catch {
      console.error("JSON parse failed:", rawText)
      parsed = {
        fname: "", lname: "", email: "", phone: "",
        linkedin: "", location: "",
        experience: "Parsed but could not read result. Please fill in manually.",
      }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("parse-resume fatal error:", String(err))
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

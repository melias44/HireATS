// Supabase Edge Function — public careers page application submission
// Deploy: npx supabase functions deploy submit-application --no-verify-jwt --project-ref tdtvactpmkzvnlufsosk
//
// Accepts multipart/form-data POST from the BDG careers page.
// Creates a candidate + application record in the ATS in real time.
// No authentication required — this is a public endpoint.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",  // Restrict to your domain in production, e.g. "https://www.bustle.com"
  "Access-Control-Allow-Headers": "content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    // Parse multipart form data
    const formData = await req.formData()

    const jobId      = formData.get("job_id")?.toString()?.trim()
    const firstName  = formData.get("first_name")?.toString()?.trim()
    const lastName   = formData.get("last_name")?.toString()?.trim()
    const email      = formData.get("email")?.toString()?.trim().toLowerCase()
    const phone              = formData.get("phone")?.toString()?.trim() || null
    const linkedin           = formData.get("linkedin_url")?.toString()?.trim() || null
    const resumeFile         = formData.get("resume") as File | null
    const workAuthRaw        = formData.get("work_authorized")?.toString()?.trim().toLowerCase()
    const salaryExpectations = formData.get("salary_expectations")?.toString()?.trim() || null

    // Convert work_authorized string to boolean (accepts "yes"/"no"/"true"/"false")
    let workAuthorized: boolean | null = null
    if (workAuthRaw === "yes" || workAuthRaw === "true") workAuthorized = true
    else if (workAuthRaw === "no" || workAuthRaw === "false") workAuthorized = false

    // Validate required fields
    if (!jobId)     throw new Error("job_id is required")
    if (!firstName) throw new Error("first_name is required")
    if (!lastName)  throw new Error("last_name is required")
    if (!email)     throw new Error("email is required")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email address")
    if (workAuthorized === null) throw new Error("Please indicate whether you are authorized to work in the US")

    // Use service role to bypass RLS for writes
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // 1. Check if job exists and is still Active
    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("id, title, status")
      .eq("id", jobId)
      .maybeSingle()

    if (jobErr || !job) throw new Error("Job not found")
    if (job.status !== "Active") throw new Error("This position is no longer accepting applications")

    // 2. Handle resume upload (optional but expected)
    let resumePath: string | null = null
    let resumeName: string | null = null

    if (resumeFile && resumeFile.size > 0) {
      const ext = resumeFile.name.split(".").pop()?.toLowerCase()
      if (!["pdf", "doc", "docx"].includes(ext || "")) {
        throw new Error("Resume must be a PDF or Word document (.pdf, .doc, .docx)")
      }
      if (resumeFile.size > 10 * 1024 * 1024) {
        throw new Error("Resume file size must be under 10MB")
      }

      // We don't have a candidate ID yet — use a temp path, rename after insert
      const tempId = crypto.randomUUID()
      const fileName = `${tempId}/${resumeFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`

      const { error: uploadErr } = await supabase.storage
        .from("resumes")
        .upload(fileName, resumeFile, { contentType: resumeFile.type, upsert: false })

      if (uploadErr) throw new Error("Failed to upload resume: " + uploadErr.message)

      resumePath = fileName
      resumeName = resumeFile.name
    }

    // 3. Check for existing candidate with same email to avoid duplicates
    const { data: existing } = await supabase
      .from("candidates")
      .select("id")
      .eq("email", email)
      .maybeSingle()

    let candidateId: string

    if (existing) {
      // Update existing candidate with any new info
      candidateId = existing.id
      const updates: Record<string, unknown> = {}
      if (phone) updates.phone = phone
      if (linkedin) updates.linkedin_url = linkedin
      if (resumePath) { updates.resume_path = resumePath; updates.resume_name = resumeName }
      if (Object.keys(updates).length) {
        await supabase.from("candidates").update(updates).eq("id", candidateId)
      }
    } else {
      // Create new candidate
      const { data: newCandidate, error: candidateErr } = await supabase
        .from("candidates")
        .insert({
          fname: firstName,
          lname: lastName,
          email,
          phone,
          linkedin_url: linkedin,
          source: "Careers Page",
          resume_path: resumePath,
          resume_name: resumeName,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single()

      if (candidateErr) throw new Error("Failed to create candidate: " + candidateErr.message)
      candidateId = newCandidate.id

      // Move resume to correct folder path now that we have the candidate ID
      if (resumePath) {
        const oldPath = resumePath
        const newPath = `${candidateId}/${resumeName!.replace(/[^a-zA-Z0-9._-]/g, "_")}`
        await supabase.storage.from("resumes").move(oldPath, newPath)
        await supabase.from("candidates").update({ resume_path: newPath }).eq("id", candidateId)
        resumePath = newPath
      }
    }

    // 4. Check if candidate already applied to this job
    const { data: existingApp } = await supabase
      .from("applications")
      .select("id")
      .eq("candidate_id", candidateId)
      .eq("job_id", jobId)
      .maybeSingle()

    if (existingApp) {
      // Already applied — still return success (don't expose this to the applicant)
      return new Response(
        JSON.stringify({ success: true, message: "Application received" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 5. Create application record
    const { error: appErr } = await supabase
      .from("applications")
      .insert({
        candidate_id: candidateId,
        job_id: jobId,
        stage: "Applied",
        applied_at: new Date().toISOString(),
        work_authorized: workAuthorized,
        salary_expectations: salaryExpectations,
      })

    if (appErr) throw new Error("Failed to create application: " + appErr.message)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Thank you, ${firstName}! Your application for ${job.title} has been received.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})

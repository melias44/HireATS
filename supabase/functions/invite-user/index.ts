// Supabase Edge Function — invite a team member by email with a role
// Deploy: npx supabase functions deploy invite-user --project-ref tdtvactpmkzvnlufsosk

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const { email, role = "member", fullName = "" } = await req.json()
    if (!email) throw new Error("email is required")
    if (!["admin", "member", "hiring_manager"].includes(role)) throw new Error("role must be admin, member, or hiring_manager")

    // Verify the calling user is authenticated
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) throw new Error("Unauthorized")

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) throw new Error("Unauthorized")

    // Check caller is admin (if no profile yet, treat as admin — first-user bootstrap)
    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .maybeSingle()

    if (callerProfile && callerProfile.role !== "admin") {
      throw new Error("Only admins can invite users")
    }

    // Use service role to send the invite
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { role, full_name: fullName },
      redirectTo: "https://hire-ats-sigma.vercel.app",
    })
    if (error) throw new Error(error.message)

    // Upsert profile so the member shows up in the team list immediately
    await adminClient.from("profiles").upsert(
      { id: data.user.id, email, full_name: fullName || null, role },
      { onConflict: "id" }
    )

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

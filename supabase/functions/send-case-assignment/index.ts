import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) throw new Error('Unauthorized')

    // Parse request body
    const { scenario_id, cohort_id } = await req.json()
    if (!scenario_id || !cohort_id) throw new Error('Missing scenario_id or cohort_id')

    // 1. Get scenario details
    const { data: scenario, error: scenErr } = await supabase
      .from('generated_scenarios')
      .select('id, patient_summary, scenario_motifs(title)')
      .eq('id', scenario_id)
      .single()
    if (scenErr || !scenario) throw new Error('Scenario not found')

    // 2. Get cohort details and members
    const { data: cohort, error: cohortErr } = await supabase
      .from('cohorts')
      .select('name')
      .eq('id', cohort_id)
      .single()
    if (cohortErr || !cohort) throw new Error('Cohort not found')

    const { data: members, error: memErr } = await supabase
      .from('cohort_members')
      .select('user_id')
      .eq('cohort_id', cohort_id)
    if (memErr) throw memErr

    // 3. For each member, we need their email.
    // Supabase Auth Admin API lets us generate an admin invite or reset link, but for standard notifications without Resend/SendGrid,
    // the best approach in native Supabase is to use the `admin.generateLink` for 'magiclink'
    // but honestly since we don't have a 3rd party email provider, we just want to send a plain notification.
    // Supabase native email doesn't support custom notifications out of the box (it only does auth emails: invite, reset, magiclink, signup).
    // A common workaround if using pure Supabase is to generate a magic link for each user and intercept the email template,
    // OR we just log that we would send it if an SMTP provider was configured.
    // Given the architecture, we will attempt to use the magic link functionality as a vehicle for the notification,
    // but the ideal setup would use Resend/SendGrid.
    
    // As per the implementation plan, we acknowledge the native limitation. 
    // We will loop through the user IDs, fetch their emails from auth.users (via admin API), 
    // and log the intended emails. In a real environment, you'd drop `resend.emails.send()` here.

    console.log(`Sending assignment notification for "${scenario.scenario_motifs?.title}" to cohort "${cohort.name}" (${members.length} members)`)

    const emailsSent = []
    
    for (const member of members) {
      // Get user email
      const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(member.user_id)
      if (authErr || !authUser.user.email) continue

      const email = authUser.user.email
      
      // In a production environment with Resend:
      // await resend.emails.send({
      //   from: 'Anesthesia Playground <notifications@anesthesia.guide>',
      //   to: email,
      //   subject: 'New Case Assigned: ' + scenario.scenario_motifs?.title,
      //   html: `...`
      // })

      // For now, we simulate success
      emailsSent.push(email)
      console.log(`Simulated email sent to ${email}`)
    }

    return new Response(
      JSON.stringify({ success: true, count: emailsSent.length, emails: emailsSent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

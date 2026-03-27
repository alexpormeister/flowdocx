import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, lifecycleId } = await req.json();
    if (!token || !lifecycleId) {
      return new Response(JSON.stringify({ error: 'Token and lifecycleId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify token
    const { data: tokenData, error: tokenError } = await supabase
      .from('presentation_tokens')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Token expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orgId = tokenData.organization_id;

    // Verify lifecycle belongs to this org
    const { data: lifecycle, error: lcError } = await supabase
      .from('customer_lifecycles')
      .select('*')
      .eq('id', lifecycleId)
      .eq('organization_id', orgId)
      .maybeSingle();

    if (lcError || !lifecycle) {
      return new Response(JSON.stringify({ error: 'Lifecycle not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get org info
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, primary_color, accent_color, logo_url')
      .eq('id', orgId)
      .single();

    // Get stages
    const { data: stages } = await supabase
      .from('customer_lifecycle_stages')
      .select('*')
      .eq('lifecycle_id', lifecycleId);

    // Get connections
    const { data: connections } = await supabase
      .from('customer_lifecycle_connections')
      .select('*')
      .eq('lifecycle_id', lifecycleId);

    // Get stage processes
    const stageIds = (stages || []).map((s: any) => s.id);
    let stageProcesses: any[] = [];
    if (stageIds.length > 0) {
      const { data } = await supabase
        .from('customer_lifecycle_stage_processes')
        .select('*')
        .in('stage_id', stageIds);
      stageProcesses = data || [];
    }

    // Get linked projects
    const projectIds = [...new Set(stageProcesses.map((sp: any) => sp.project_id))];
    let projects: any[] = [];
    if (projectIds.length > 0) {
      const { data } = await supabase
        .from('projects')
        .select('id, name, description, status')
        .in('id', projectIds);
      projects = data || [];
    }

    return new Response(JSON.stringify({
      token: tokenData,
      organization: org,
      lifecycle,
      stages: stages || [],
      connections: connections || [],
      stageProcesses,
      projects,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

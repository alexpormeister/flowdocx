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
    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Token required' }), {
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

    // Check expiry
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Token expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orgId = tokenData.organization_id;

    // Get org info
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, primary_color, accent_color, logo_url')
      .eq('id', orgId)
      .single();

    // Get projects
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, description, bpmn_xml, process_steps, system_tags, status, owner_name, owner_email, folder_id')
      .eq('organization_id', orgId)
      .order('name');

    // Get folders
    const { data: folders } = await supabase
      .from('folders')
      .select('id, name, color, parent_id')
      .eq('organization_id', orgId)
      .order('name');

    let visibleProjects: any[] = projects || [];
    let visibleFolders: any[] = folders || [];
    const scope: string[] | null = Array.isArray(tokenData.folder_ids) && tokenData.folder_ids.length > 0
      ? tokenData.folder_ids : null;
    if (scope) {
      const allowed = new Set<string>(scope);
      let changed = true;
      while (changed) {
        changed = false;
        for (const f of visibleFolders) {
          if (f.parent_id && allowed.has(f.parent_id) && !allowed.has(f.id)) {
            allowed.add(f.id); changed = true;
          }
        }
      }
      visibleFolders = visibleFolders
        .filter((f: any) => allowed.has(f.id))
        .map((f: any) => ({ ...f, parent_id: f.parent_id && allowed.has(f.parent_id) ? f.parent_id : null }));
      visibleProjects = visibleProjects.filter((p: any) => p.folder_id && allowed.has(p.folder_id));
    }

    // Get element links for all projects
    const projectIds = visibleProjects.map((p: any) => p.id);
    let elementLinks: any[] = [];
    if (projectIds.length > 0) {
      const { data } = await supabase
        .from('element_links')
        .select('*')
        .in('project_id', projectIds);
      elementLinks = data || [];
    }

    return new Response(JSON.stringify({
      token: tokenData,
      organization: org,
      projects: projects || [],
      folders: folders || [],
      elementLinks,
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

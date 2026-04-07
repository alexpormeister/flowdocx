import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");

    // Verify the calling user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Check superadmin
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: sa } = await adminClient.from("superadmins").select("id").eq("user_id", user.id).maybeSingle();
    if (!sa) throw new Error("Not a superadmin");

    const { action, org_id, archive_id } = await req.json();

    if (action === "archive") {
      // Archive: save org data, then delete
      const { data: org } = await adminClient.from("organizations").select("*").eq("id", org_id).single();
      if (!org) throw new Error("Organization not found");

      const { data: projects } = await adminClient.from("projects").select("*").eq("organization_id", org_id);
      const { data: members } = await adminClient.from("organization_members").select("*").eq("organization_id", org_id);
      const { data: folders } = await adminClient.from("folders").select("*").eq("organization_id", org_id);

      const { data: archive, error: archiveErr } = await adminClient.from("deleted_organizations").insert({
        original_org_id: org_id,
        org_data: org,
        projects_data: projects || [],
        members_data: members || [],
        folders_data: folders || [],
        deleted_by: user.id,
      }).select().single();
      if (archiveErr) throw archiveErr;

      // Delete the organization (cascades)
      const { error: delErr } = await adminClient.from("organizations").delete().eq("id", org_id);
      if (delErr) throw delErr;

      return new Response(JSON.stringify({ success: true, archive_id: archive.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "restore") {
      const { data: archive } = await adminClient.from("deleted_organizations")
        .select("*").eq("id", archive_id).is("restored_at", null).single();
      if (!archive) throw new Error("Archive not found or already restored");

      const orgData = archive.org_data as any;
      // Re-create organization
      const { error: orgErr } = await adminClient.from("organizations").insert({
        id: orgData.id,
        name: orgData.name,
        business_id: orgData.business_id,
        logo_url: orgData.logo_url,
        notes: orgData.notes,
        primary_color: orgData.primary_color,
        accent_color: orgData.accent_color,
      });
      if (orgErr) throw orgErr;

      // Restore folders
      const foldersData = archive.folders_data as any[];
      if (foldersData?.length) {
        // Sort: parent folders first
        const sorted = foldersData.sort((a: any, b: any) => (a.parent_id ? 1 : 0) - (b.parent_id ? 1 : 0));
        for (const f of sorted) {
          await adminClient.from("folders").insert({
            id: f.id, name: f.name, user_id: f.user_id, organization_id: f.organization_id,
            parent_id: f.parent_id, color: f.color, system_tags: f.system_tags, notes: f.notes,
          });
        }
      }

      // Restore members
      const membersData = archive.members_data as any[];
      if (membersData?.length) {
        for (const m of membersData) {
          await adminClient.from("organization_members").insert({
            organization_id: m.organization_id, user_id: m.user_id, email: m.email,
            role: m.role, invited_by: m.invited_by, accepted_at: m.accepted_at,
            position_id: null, title: m.title,
          });
        }
      }

      // Restore projects
      const projectsData = archive.projects_data as any[];
      if (projectsData?.length) {
        for (const p of projectsData) {
          await adminClient.from("projects").insert({
            id: p.id, name: p.name, bpmn_xml: p.bpmn_xml, user_id: p.user_id,
            organization_id: p.organization_id, folder_id: p.folder_id,
            description: p.description, status: p.status, notes: p.notes,
            system_tags: p.system_tags, process_steps: p.process_steps,
          });
        }
      }

      // Mark as restored
      await adminClient.from("deleted_organizations").update({ restored_at: new Date().toISOString() }).eq("id", archive_id);

      return new Response(JSON.stringify({ success: true, org_id: orgData.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

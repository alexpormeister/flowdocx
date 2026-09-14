import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Missing access token" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: claimsData, error: claimsError } = await adminClient.auth.getClaims(token);
    const callerId = claimsData?.claims?.sub;
    if (claimsError || !callerId) return json({ error: "Unauthorized" }, 401);

    const { data: sa } = await adminClient
      .from("superadmins")
      .select("id")
      .eq("user_id", callerId)
      .maybeSingle();
    if (!sa) return json({ error: "Not a superadmin" }, 403);

    const { user_id, password } = await req.json();
    if (!user_id || typeof user_id !== "string" || !password || typeof password !== "string") {
      return json({ error: "user_id and password are required" }, 400);
    }
    if (password.length < 6 || password.length > 128) {
      return json({ error: "Password must be 6-128 characters" }, 400);
    }

    const { data, error } = await adminClient.auth.admin.updateUserById(user_id, { password });
    if (error) return json({ error: error.message }, 400);

    return json({ user: { id: data.user.id, email: data.user.email } });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing access token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    const callerId = userData?.user?.id;

    if (userError || !callerId) {
      console.error("Auth error:", userError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorize via the superadmins table (single source of truth)
    const { data: sa, error: saError } = await adminClient
      .from("superadmins")
      .select("id")
      .eq("user_id", callerId)
      .maybeSingle();

    if (saError || !sa) {
      return new Response(JSON.stringify({ error: "Not a superadmin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password, display_name } = await req.json();

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return new Response(JSON.stringify({ error: "Email and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 6 || password.length > 128 || email.length > 320) {
      return new Response(JSON.stringify({ error: "Invalid email or password length" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: display_name ? { display_name } : undefined,
    });

    if (error) {
      console.error("createUser failed:", error.status, error.code, error.message);
      const msg = (error.message || "").toLowerCase();
      let friendly = error.message;
      if (msg.includes("already") && msg.includes("registered")) {
        friendly = "Tällä sähköpostilla on jo käyttäjätunnus / A user with this email already exists";
      } else if (msg.includes("weak") || msg.includes("pwned") || msg.includes("leaked")) {
        friendly = "Salasana on liian heikko tai esiintynyt tietovuodoissa — valitse vahvempi salasana / Password is too weak or found in a data breach";
      } else if (msg.includes("invalid") && msg.includes("email")) {
        friendly = "Virheellinen sähköpostiosoite / Invalid email address";
      }
      return new Response(JSON.stringify({ error: friendly }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ user: { id: data.user.id, email: data.user.email } }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

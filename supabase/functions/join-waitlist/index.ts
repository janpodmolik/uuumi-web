import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 3; // max 3 requests per window per IP

const ALLOWED_ORIGINS = [
  "https://uuumi.app",
  "http://localhost:4321",
  "http://localhost:3000",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, apikey, x-client-info",
  };
}

// Reuse the admin client across requests within the same isolate
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

/**
 * Check and increment rate limit for an IP using the rate_limits table.
 * Returns true if the IP has exceeded the limit.
 */
async function isRateLimited(ip: string): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);

  // Try to get existing entry
  const { data } = await supabaseAdmin
    .from("rate_limits")
    .select("count, window_start")
    .eq("ip", ip)
    .single();

  if (!data || new Date(data.window_start) < windowStart) {
    // No entry or expired window — reset
    await supabaseAdmin.from("rate_limits").upsert({
      ip,
      count: 1,
      window_start: now.toISOString(),
    });
    return false;
  }

  // Window still active — increment
  const newCount = data.count + 1;
  await supabaseAdmin
    .from("rate_limits")
    .update({ count: newCount })
    .eq("ip", ip);

  return newCount > RATE_LIMIT_MAX;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  // Get client IP for rate limiting
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  // Check rate limit (DB-backed, shared across all edge instances)
  if (await isRateLimited(ip)) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      {
        status: 429,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      },
    );
  }

  try {
    const body = await req.json();
    const { email, theme, honeypot } = body;

    // Honeypot check — if the hidden field is filled, it's a bot
    if (honeypot) {
      // Return success to not reveal the trap, but do nothing
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Validate email
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Email is required." }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address." }),
        {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        },
      );
    }

    const { error } = await supabaseAdmin
      .from("waitlist")
      .insert({ email, theme: theme || "dark" });

    if (error) {
      // Duplicate email
      if (error.code === "23505") {
        return new Response(
          JSON.stringify({ success: true, duplicate: true }),
          {
            status: 200,
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          },
        );
      }

      console.error("Supabase insert error:", error);
      return new Response(
        JSON.stringify({ error: "Something went wrong. Please try again." }),
        {
          status: 500,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Invalid request." }), {
      status: 400,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

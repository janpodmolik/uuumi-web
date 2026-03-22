import "@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

interface WebhookPayload {
  type: "INSERT";
  table: string;
  record: {
    id: string;
    email: string;
    theme: string;
    created_at: string;
  };
}

Deno.serve(async (req) => {
  try {
    const payload: WebhookPayload = await req.json();

    if (payload.type !== "INSERT" || payload.table !== "waitlist") {
      return new Response("Ignored", { status: 200 });
    }

    const email = payload.record.email;
    const theme = payload.record.theme || "dark";

    const isDark = theme === "dark";

    // Theme-dependent styles
    const bg = isDark ? "#120e28" : "#f5f5f5";
    const gradient = isDark
      ? "linear-gradient(180deg, #1f1a4d 0%, #402e73 30%, #734d8c 60%, #8c5980 100%)"
      : "linear-gradient(180deg, #adbfd9 0%, #c7ccd9 30%, #e6d9d1 60%, #edd1bf 100%)";
    const cardBg = isDark ? "rgba(28, 22, 58, 0.85)" : "rgba(255, 255, 255, 0.9)";
    const cardBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
    const heading = isDark ? "#f0f0f0" : "#111111";
    const subtext = isDark ? "rgba(255,255,255,0.6)" : "#666666";
    const body = isDark ? "rgba(255,255,255,0.7)" : "#444444";
    const claimBg = isDark ? "rgba(52, 199, 89, 0.1)" : "rgba(52, 199, 89, 0.08)";
    const claimLabel = isDark ? "rgba(255,255,255,0.5)" : "#999999";
    const claimExpiry = isDark ? "rgba(255,255,255,0.4)" : "#999999";
    const footer = isDark ? "rgba(255,255,255,0.35)" : "#999999";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Uuumi <hello@uuumi.app>",
        to: [email],
        subject: "You're in. Your Uuumi is waiting.",
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: ${bg}; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${gradient}; min-height: 100%;">
    <tr>
      <td align="center" style="padding: 48px 20px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width: 480px; width: 100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <img src="https://uuumi.app/images/pets/blob-happy.png" alt="Uuumi" width="86" height="64" style="display: block; border-radius: 16px;" />
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background: ${cardBg}; border-radius: 20px; padding: 40px 32px; border: 1px solid ${cardBorder};">

              <h1 style="margin: 0 0 8px; font-size: 28px; font-weight: 800; color: ${heading}; letter-spacing: -0.03em; text-align: center; line-height: 1.2;">
                You're in.
              </h1>
              <p style="margin: 0 0 28px; font-size: 16px; color: ${subtext}; text-align: center; line-height: 1.6;">
                Your screen time just got a face.
              </p>

              <p style="margin: 0 0 16px; font-size: 15px; color: ${body}; line-height: 1.7;">
                You've joined the Uuumi waitlist — and your future pet is already counting on you. Less scrolling means a happier Uuumi. The more you scroll, the harder the wind blows.
              </p>

              <p style="margin: 0 0 24px; font-size: 15px; color: ${body}; line-height: 1.7;">
                We'll let you know the moment it's time to meet yours.
              </p>

              <!-- Claim code box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background: ${claimBg}; border: 1px dashed #34C759; border-radius: 12px; padding: 20px; text-align: center;">
                    <p style="margin: 0 0 8px; font-size: 13px; color: ${claimLabel}; text-transform: uppercase; letter-spacing: 0.08em;">
                      Your OG Essence Claim Code
                    </p>
                    <p style="margin: 0 0 8px; font-size: 24px; font-weight: 800; color: #34C759; letter-spacing: 0.08em;">
                      UUUBELIEVER
                    </p>
                    <p style="margin: 0; font-size: 12px; color: ${claimExpiry}; font-style: italic;">
                      Valid for the first 3 months after release
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 32px;">
              <p style="margin: 0; font-size: 13px; color: ${footer}; line-height: 1.6;">
                Uuumi — A screen time app your pet depends on.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend error:", data);
      return new Response(JSON.stringify({ error: data }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
    });
  }
});

/**
 * provision-educator — After an educator request is marked approved, creates or upgrades
 * the Auth user, sets profiles.role = instructor, clears stored request password,
 * and emails the requester (Resend when RESEND_API_KEY + MAIL_FROM are set).
 *
 * POST JSON: { request_id: string }
 * Requires: Bearer JWT of master admin (MASTER_ADMIN_EMAIL, default firenixx2k@gmail.com).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MASTER_EMAIL =
  (Deno.env.get("MASTER_ADMIN_EMAIL") ?? "firenixx2k@gmail.com").trim().toLowerCase();

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function randomPassword(length = 18): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[buf[i] % chars.length];
  return out;
}

async function findUserIdByEmail(service: ReturnType<typeof createClient>, emailNorm: string) {
  const target = emailNorm.trim().toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => (x.email ?? "").toLowerCase() === target);
    if (u) return u.id;
    if (data.users.length < 200) break;
  }
  return null;
}

type MailResult = { sent: boolean; detail?: string };

async function sendApprovedEmail(
  to: string,
  name: string,
  loginUrl: string,
  hadPreset: boolean,
  temporaryPassword: string | null,
): Promise<MailResult> {
  const rawKey = Deno.env.get("RESEND_API_KEY");
  const key = typeof rawKey === "string" ? rawKey.trim() : "";
  const rawFrom = Deno.env.get("MAIL_FROM");
  const from =
    typeof rawFrom === "string" && rawFrom.trim()
      ? rawFrom.trim()
      : "Anesthesia Playground <onboarding@resend.dev>";

  let bodyHtml = `<p>Hello ${escapeHtml(name)},</p>`;
  bodyHtml +=
    `<p>Your educator account request for <strong>Anesthesia Playground</strong> has been <strong>approved</strong>.</p>`;
  bodyHtml += `<p>You can sign in as an <strong>instructor</strong> here:</p>`;
  bodyHtml +=
    `<p><a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></p>`;

  if (hadPreset) {
    bodyHtml +=
      `<p>Sign in using <strong>this email address</strong> and the <strong>password you chose</strong> when you submitted your instructor request.</p>`;
  } else if (temporaryPassword) {
    bodyHtml += `<p>We created an account with this email. Your temporary password is:</p>`;
    bodyHtml += `<p style="font-size:1rem;font-family:monospace">${escapeHtml(
      temporaryPassword,
    )}</p>`;
    bodyHtml +=
      `<p>For security, sign in promptly and update your password from the account/profile options if available.</p>`;
  } else {
    bodyHtml +=
      `<p>Use your existing password or magic link flow for this email. If you do not yet have login credentials, open the link above and use <strong>Forgot password</strong>.</p>`;
  }

  if (!key) {
    console.warn("RESEND_API_KEY missing or empty at runtime.");
    return {
      sent: false,
      detail:
        "Secret RESEND_API_KEY is missing or blank for this Edge Function (name must match exactly). If you added it in the Dashboard, redeploy saving the code once, then check Logs for this warning.",
    };
  }

  let resp: Response;
  try {
    resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "Your instructor access is ready — Anesthesia Playground",
        html: bodyHtml,
      }),
    });
  } catch (netErr) {
    const msg = netErr instanceof Error ? netErr.message : String(netErr);
    console.error("Resend fetch error:", msg);
    return { sent: false, detail: `Could not reach Resend: ${msg}` };
  }

  if (!resp.ok) {
    const t = await resp.text();
    console.error("Resend error:", resp.status, t);
    return {
      sent: false,
      detail:
        `Resend returned HTTP ${resp.status}: ${t.slice(0, 280)}`.trim() +
        " — verify MAIL_FROM domain in Resend, API key validity, and that the recipient address is allowed.",
    };
  }
  return { sent: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    const jwt = authHeader?.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) throw new Error("Missing Authorization Bearer token");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: authData, error: authErr } = await userClient.auth.getUser(jwt);
    const adminUser = authData?.user;
    if (authErr || !adminUser?.email)
      throw new Error("Unauthorized: invalid token");
    if (adminUser.email.trim().toLowerCase() !== MASTER_EMAIL) {
      return json(403, { error: "forbidden", hint: "master admin only" });
    }

    const { request_id } = await req.json();
    if (!request_id || typeof request_id !== "string") {
      return json(400, { error: "missing_request_id" });
    }

    const { data: reqRow, error: reqErr } = await service
      .from("educator_requests")
      .select(
        "id, name, email, institution, role_title, use_case, message, status, provisioned_at, created_at",
      )
      .eq("id", request_id)
      .single();

    if (reqErr || !reqRow) throw new Error("Request not found");
    if (reqRow.status !== "approved") {
      return json(400, { error: "not_approved", message: "Set status to approved first, then retry." });
    }

    const emailNorm = (reqRow.email as string).trim().toLowerCase();
    const name = (reqRow.name as string).trim();

    if (reqRow.provisioned_at) {
      return json(200, { ok: true, idempotent: true });
    }

    const { data: secRow } = await service
      .from("educator_request_secrets")
      .select("initial_password")
      .eq("request_id", request_id)
      .maybeSingle();

    const presetPassword = secRow?.initial_password ?? null;

    let userId: string | null = await findUserIdByEmail(service, emailNorm);
    let emailedTempPw: string | null = null;
    const hadPreset = !!presetPassword;
    let createdNew = false;

    if (!userId) {
      createdNew = true;
      const pwd = presetPassword ?? randomPassword(18);
      if (!presetPassword) emailedTempPw = pwd;

      const { data: created, error: cErr } = await service.auth.admin.createUser({
        email: emailNorm,
        password: pwd,
        email_confirm: true,
        user_metadata: { full_name: name },
      });
      if (cErr) throw new Error(`createUser: ${cErr.message}`);
      const uid = created?.user?.id;
      if (!uid) throw new Error("createUser returned no user id");
      userId = uid;
    } else {
      const { data: au } = await service.auth.admin.getUserById(userId);
      const meta = {
        ...(au?.user?.user_metadata ?? {}) as Record<string, unknown>,
        full_name: name,
      };

      await service.auth.admin.updateUserById(userId, {
        user_metadata: meta,
        ...(presetPassword ? { password: presetPassword } : {}),
        email_confirm: true,
      });
    }

    const inst = ((reqRow.institution as string) ?? "Yale").trim();

    const { error: upErr } = await service.from("profiles").upsert(
      {
        id: userId,
        role: "instructor",
        display_name: name || emailNorm.split("@")[0],
        institution: inst || "Yale",
      },
      { onConflict: "id" },
    );
    if (upErr) throw upErr;

    await service.from("educator_request_secrets").delete().eq(
      "request_id",
      request_id,
    );

    const nowIso = new Date().toISOString();
    await service.from("educator_requests").update({
      provisioned_at: nowIso,
    }).eq("id", request_id);

    const loginUrl = Deno.env.get("LOGIN_PAGE_URL") ??
      "https://anesthesia.guide/platform/auth.html";
    let emailSent = false;
    let emailDetail: string | undefined;
    try {
      const mr = await sendApprovedEmail(
        emailNorm,
        name || emailNorm.split("@")[0],
        loginUrl,
        hadPreset,
        emailedTempPw,
      );
      emailSent = mr.sent;
      emailDetail = mr.detail;
    } catch (mailErr) {
      console.warn("Email failed (provision completed):", mailErr);
      emailSent = false;
      emailDetail = mailErr instanceof Error ? mailErr.message : String(mailErr);
    }

    return json(200, {
      ok: true,
      email_sent: emailSent,
      email_detail: emailDetail ?? null,
      mail_from_used: Deno.env.get("MAIL_FROM")?.trim()
        ? "custom"
        : "default_onboarding_at_resend",
      user_id: userId,
      created_new: createdNew,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return json(400, { error: msg });
  }
});

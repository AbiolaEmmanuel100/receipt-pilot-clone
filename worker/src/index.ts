/**
 * Receipt Pilot-C Cloudflare Worker
 * Secure server-side operations only (billing webhooks, privileged actions).
 * No secrets are committed.
 */

export interface Env {
  PAYSTACK_SECRET_KEY?: string;
  PAYSTACK_WEBHOOK_SECRET?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, service: "receipt-pilot-c-worker" }), {
        headers: { "content-type": "application/json" },
      });
    }

    return new Response("Receipt Pilot-C Worker — not yet implemented", { status: 501 });
  },
};

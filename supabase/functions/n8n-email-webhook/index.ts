import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const N8N_WEBHOOK_SECRET = Deno.env.get("N8N_WEBHOOK_SECRET") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-n8n-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface EmailQueueItem {
  id: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  html_content: string;
  email_type: string;
  metadata: Record<string, any> | null;
  campaign_id: string | null;
  user_id: string | null;
}

interface RequestBody {
  action: "get_pending_emails" | "mark_as_sent" | "mark_as_failed" | "get_campaign_recipients" | "health_check";
  limit?: number;
  email_id?: string;
  email_ids?: string[];
  campaign_id?: string;
  error_message?: string;
}

const validateSecret = (req: Request): boolean => {
  if (!N8N_WEBHOOK_SECRET) {
    console.warn("[Auth] N8N_WEBHOOK_SECRET not configured - allowing all requests");
    return true;
  }
  
  const providedSecret = req.headers.get("x-n8n-secret");
  return providedSecret === N8N_WEBHOOK_SECRET;
};

serve(async (req: Request): Promise<Response> => {
  console.log("[n8n-email-webhook] Request received");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate secret
  if (!validateSecret(req)) {
    console.error("[Auth] Invalid or missing x-n8n-secret header");
    return new Response(
      JSON.stringify({ error: "Unauthorized", message: "Invalid or missing x-n8n-secret header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    const body: RequestBody = await req.json();
    console.log(`[Action] ${body.action}`);

    // ============= HEALTH CHECK =============
    if (body.action === "health_check") {
      return new Response(
        JSON.stringify({ 
          status: "ok", 
          timestamp: new Date().toISOString(),
          supabase_configured: !!SUPABASE_URL,
          secret_configured: !!N8N_WEBHOOK_SECRET
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= GET PENDING EMAILS =============
    if (body.action === "get_pending_emails") {
      const limit = Math.min(body.limit || 10, 50); // Max 50 emails per request
      
      const { data: emails, error } = await supabase
        .from("email_queue")
        .select("id, to_email, to_name, subject, html_content, email_type, metadata, campaign_id, user_id")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(limit);

      if (error) {
        console.error("[DB] Error fetching pending emails:", error);
        return new Response(
          JSON.stringify({ error: "Database error", details: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Pending] Found ${emails?.length || 0} emails`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          count: emails?.length || 0,
          emails: emails || []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= MARK AS SENT =============
    if (body.action === "mark_as_sent") {
      const emailIds = body.email_ids || (body.email_id ? [body.email_id] : []);
      
      if (emailIds.length === 0) {
        return new Response(
          JSON.stringify({ error: "email_id or email_ids is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("email_queue")
        .update({ 
          status: "sent", 
          sent_at: new Date().toISOString() 
        })
        .in("id", emailIds)
        .select("id");

      if (error) {
        console.error("[DB] Error marking emails as sent:", error);
        return new Response(
          JSON.stringify({ error: "Database error", details: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Sent] Marked ${data?.length || 0} emails as sent`);

      return new Response(
        JSON.stringify({ success: true, updated: data?.length || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= MARK AS FAILED =============
    if (body.action === "mark_as_failed") {
      const emailIds = body.email_ids || (body.email_id ? [body.email_id] : []);
      
      if (emailIds.length === 0) {
        return new Response(
          JSON.stringify({ error: "email_id or email_ids is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get current retry counts
      const { data: currentEmails } = await supabase
        .from("email_queue")
        .select("id, retry_count")
        .in("id", emailIds);

      // Update with incremented retry count
      for (const email of currentEmails || []) {
        const newRetryCount = (email.retry_count || 0) + 1;
        const status = newRetryCount >= 3 ? "failed" : "pending"; // Keep pending for retry if < 3 attempts
        
        await supabase
          .from("email_queue")
          .update({ 
            status,
            retry_count: newRetryCount,
            error_message: body.error_message || "Unknown error"
          })
          .eq("id", email.id);
      }

      console.log(`[Failed] Updated ${emailIds.length} emails`);

      return new Response(
        JSON.stringify({ success: true, updated: emailIds.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= GET CAMPAIGN RECIPIENTS =============
    if (body.action === "get_campaign_recipients") {
      if (!body.campaign_id) {
        return new Response(
          JSON.stringify({ error: "campaign_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: emails, error } = await supabase
        .from("email_queue")
        .select("id, to_email, to_name, status, sent_at, error_message")
        .eq("campaign_id", body.campaign_id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[DB] Error fetching campaign recipients:", error);
        return new Response(
          JSON.stringify({ error: "Database error", details: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const stats = {
        total: emails?.length || 0,
        pending: emails?.filter(e => e.status === "pending").length || 0,
        sent: emails?.filter(e => e.status === "sent").length || 0,
        failed: emails?.filter(e => e.status === "failed").length || 0,
      };

      return new Response(
        JSON.stringify({ success: true, stats, emails }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= UNKNOWN ACTION =============
    return new Response(
      JSON.stringify({ 
        error: "Unknown action", 
        available_actions: ["get_pending_emails", "mark_as_sent", "mark_as_failed", "get_campaign_recipients", "health_check"]
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[Error] Unhandled:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const adminEmails = new Set([
  "jeferson.zanotell@gmail.com",
  "jefeson.zanotell@gmail.com",
]);
type Json = Record<string, unknown>;

function reply(body: Json, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
async function graphPost(
  path: string,
  fields: Record<string, string>,
  token: string,
  version: string
) {
  const body = new URLSearchParams({ ...fields, access_token: token });
  const result = await fetch(
    "https://graph.facebook.com/" + version + "/" + path,
    { method: "POST", body }
  );
  const payload = await result.json().catch(() => ({}));
  if (!result.ok || payload.error) {
    throw new Error(
      "Meta API: " +
        String(payload?.error?.message || payload?.error || result.status)
    );
  }
  return payload;
}
async function publishPost(
  post: Record<string, any>,
  accountId: string,
  token: string,
  version: string
) {
  const urls = Array.from(new Set([
    ...(Array.isArray(post.media_urls) ? post.media_urls : []),
    post.media_url,
  ].filter(Boolean).map(String)));

  if (!urls.length) {
    throw new Error("Adicione ao menos uma URL publica de imagem antes de publicar.");
  }

  const caption = [
    String(post.caption || "").trim(),
    Array.isArray(post.hashtags) ? post.hashtags.join(" ") : "",
  ].filter(Boolean).join("\n\n");

  let containerId: string;
  if (urls.length > 1) {
    const children = await Promise.all(
      urls.slice(0, 10).map((imageUrl) =>
        graphPost(
          accountId + "/media",
          { image_url: imageUrl, is_carousel_item: "true" },
          token,
          version
        )
      )
    );
    const childIds = children.map((item) => String(item.id)).filter(Boolean);
    if (childIds.length < 2) {
      throw new Error("Um carrossel precisa de pelo menos duas imagens validas.");
    }
    const parent = await graphPost(
      accountId + "/media",
      {
        media_type: "CAROUSEL",
        children: childIds.join(","),
        caption,
      },
      token,
      version
    );
    containerId = String(parent.id);
  } else {
    const container = await graphPost(
      accountId + "/media",
      {
        image_url: urls[0],
        caption,
        alt_text: String(post.alt_text || "").slice(0, 1000),
      },
      token,
      version
    );
    containerId = String(container.id);
  }

  const published = await graphPost(
    accountId + "/media_publish",
    { creation_id: containerId },
    token,
    version
  );
  return {
    containerId,
    mediaId: String(published.id),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply({ success: false, error: "Metodo nao permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
  const accountId = Deno.env.get("INSTAGRAM_BUSINESS_ACCOUNT_ID");
  const graphVersion = Deno.env.get("META_GRAPH_API_VERSION") || "v25.0";
  const cronSecret = Deno.env.get("INSTAGRAM_CRON_SECRET");

  if (!url || !anon || !service) {
    return reply({ success: false, error: "Supabase nao configurado." }, 500);
  }
  if (!token || !accountId) {
    return reply({
      success: false,
      error: "Conecte a conta Meta configurando INSTAGRAM_ACCESS_TOKEN e INSTAGRAM_BUSINESS_ACCOUNT_ID.",
    }, 503);
  }

  try {
    const authorization = req.headers.get("Authorization") || "";
    const requestCronSecret = req.headers.get("x-cron-secret") || "";
    const cronAuthorized = Boolean(
      cronSecret &&
      (requestCronSecret === cronSecret || authorization === "Bearer " + cronSecret)
    );
    const admin = createClient(url, service);

    let actorId: string | null = null;
    if (!cronAuthorized) {
      const userClient = createClient(url, anon, {
        global: { headers: { Authorization: authorization } },
      });
      const { data: auth, error: authError } = await userClient.auth.getUser();
      if (authError || !auth.user) {
        return reply({ success: false, error: "Sessao invalida." }, 401);
      }
      const { data: adminFlag } = await admin.rpc("is_admin", {
        _user_id: auth.user.id,
      });
      const allowed = adminFlag === true ||
        adminEmails.has(String(auth.user.email || "").trim().toLowerCase());
      if (!allowed) {
        return reply({ success: false, error: "Acesso exclusivo para administradores." }, 403);
      }
      actorId = auth.user.id;
    }

    const input = await req.json().catch(() => ({}));
    const postId = input.post_id ? String(input.post_id) : null;
    let posts: Array<Record<string, any>> = [];

    if (postId) {
      const { data, error } = await admin
        .from("instagram_content_posts")
        .select("*")
        .eq("id", postId)
        .in("status", ["approved", "scheduled", "failed"])
        .single();
      if (error || !data) throw new Error("Post nao encontrado ou nao aprovado.");
      posts = [data];
    } else {
      const { data, error } = await admin
        .from("instagram_content_posts")
        .select("*")
        .eq("status", "scheduled")
        .lte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(5);
      if (error) throw error;
      posts = data || [];
    }

    const results: Array<Record<string, unknown>> = [];
    for (const post of posts) {
      const availableMedia = [
        ...(Array.isArray(post.media_urls) ? post.media_urls : []),
        post.media_url,
      ].filter(Boolean);
      if (!availableMedia.length) {
        results.push({
          id: post.id,
          success: false,
          skipped: true,
          error: "Aguardando imagem publica.",
        });
        continue;
      }

      try {
        const { data: locked } = await admin
          .from("instagram_content_posts")
          .update({ status: "publishing", last_error: null })
          .eq("id", post.id)
          .in("status", ["approved", "scheduled", "failed"])
          .select("id")
          .maybeSingle();
        if (!locked) continue;

        const published = await publishPost(post, accountId, token, graphVersion);
        await admin.from("instagram_content_posts").update({
          status: "published",
          published_at: new Date().toISOString(),
          instagram_container_id: published.containerId,
          instagram_media_id: published.mediaId,
          approved_by: post.approved_by || actorId,
          last_error: null,
        }).eq("id", post.id);

        results.push({ id: post.id, success: true, media_id: published.mediaId });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const retry = Number(post.retry_count || 0) + 1;
        const exhausted = retry >= Number(post.max_retries || 3);
        await admin.from("instagram_content_posts").update({
          status: exhausted ? "failed" : "scheduled",
          retry_count: retry,
          scheduled_at: exhausted
            ? post.scheduled_at
            : new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          last_error: message.slice(0, 1000),
        }).eq("id", post.id);
        results.push({ id: post.id, success: false, error: message });
      }
    }

    return reply({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("[instagram-publisher]", error);
    return reply({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
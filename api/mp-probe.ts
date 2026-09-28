export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  const upstream = await fetch(
    "https://ihtltqxxlvbsxbiacbpr.supabase.co/functions/v1/mp-sandbox-doctor-temp?k=mpsbx-9c45f8b2e17d4a698cd34f1082ab75e9",
    { headers: { "accept": "application/json" } },
  );
  const text = await upstream.text();
  res.status(upstream.status).setHeader("content-type", "application/json").send(text);
}

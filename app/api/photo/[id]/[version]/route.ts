import { createClient } from "@supabase/supabase-js";
import { database, previewAllowed } from "@/app/server/preview";
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; version: string }> },
) {
  const { id, version } = await params;
  if (!uuid.test(id) || !uuid.test(version))
    return new Response(null, { status: 404 });
  try {
    let photo: string | null;
    if (previewAllowed(req))
      photo = (
        await (
          await database()
        ).query<{ photo: string | null }>("select fb_photo($1,$2) photo", [
          id,
          version,
        ])
      ).rows[0].photo;
    else {
      const db = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const { data, error } = await db.rpc("fb_photo", {
        p_id: id,
        p_version: version,
      });
      if (error) throw error;
      photo = data;
    }
    if (!photo) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(Buffer.from(photo, "base64")), {
      headers: {
        "Content-Type": "image/jpeg",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}

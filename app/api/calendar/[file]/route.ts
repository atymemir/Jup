import { createClient } from "@supabase/supabase-js";
import { database, previewAllowed } from "../../../server/preview";
import { calendarFile, type CalendarItem } from "../../../lib/schedule";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};
export async function GET(
  req: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  if (!/^[a-f0-9]{64}\.ics$/.test(file))
    return new Response(null, { status: 404, headers });
  const key = file.slice(0, -4);
  try {
    let events: CalendarItem[] | null;
    if (previewAllowed(req)) {
      const db = await database();
      events = (
        await db.query<{ v: CalendarItem[] | null }>(
          "select fb_calendar_feed($1) v",
          [key],
        )
      ).rows[0].v;
    } else {
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const { data, error } = await client.rpc("fb_calendar_feed", {
        p_key: key,
      });
      if (error) throw error;
      events = data;
    }
    return events === null
      ? new Response(null, { status: 404, headers })
      : new Response(calendarFile(events), {
          headers: {
            ...headers,
            "Content-Type": "text/calendar; charset=utf-8",
          },
        });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}

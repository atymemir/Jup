import { fileURLToPath } from "node:url";
if (process.env.VERCEL &&
    (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
  throw new Error("FindBuddy requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY on Vercel. Local preview accounts cannot persist on serverless hosting.");
}
export default {
  basePath: "/findbuddy",
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  serverExternalPackages: ["@electric-sql/pglite"],
};

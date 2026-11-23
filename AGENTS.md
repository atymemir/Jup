# findbuddy in Jup

This is the standalone findbuddy application, extracted from PrepWeb. Jup is the repository name; do not rebrand product copy, routes, database objects, storage keys or environment variables unless the user requests it.

- Read the relevant installed guides in `node_modules/next/dist/docs/` before changing Next.js code. This project uses Next.js 16.
- The application keeps `/findbuddy` as its basePath to preserve existing links and the tryalga.app proxy. All product source and migrations live in this repository.
- Preserve the established visual system; avoid unrelated changes and unnecessary dependencies.
- Never commit `.env*` except the empty `.env.example`, `.vercel`, `.data`, credentials, account exports or user data. The GitHub repository is public.
- Never expose server credentials in client components. Preserve server-side role checks and user data isolation.
- The current hosted app shares the existing algₐ Supabase project. Do not change Supabase Auth, remove shared objects or migrate production users as a side effect of a code change.
- Keep the original SQL migration filenames and apply only missing migrations after inspection. Do not rerun ownership/bootstrap migrations blindly.
- Run `npm run build`, `npm run lint`, and `npm test` for meaningful changes. Verify affected user flows; report files changed, behavior, unchanged scope, validation, remaining risks and manual checks.

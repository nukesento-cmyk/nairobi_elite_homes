// Run against a production server started with SANITY_REVALIDATE_SECRET set:
//   SANITY_REVALIDATE_SECRET=<secret> pnpm check-revalidation
//
// `next build` can't catch this: a client hook such as usePathname() outside
// <Suspense> passes the build, then makes dynamic routes return a 500 as soon as
// a CMS publish forces their shells to regenerate.
const base = process.env.CHECK_BASE_URL ?? "http://localhost:3000";
const secret = process.env.SANITY_REVALIDATE_SECRET;
if (!secret) throw new Error("Set SANITY_REVALIDATE_SECRET to match the running server.");

const routes = process.argv.slice(2);
const defaults = ["/", "/homes", "/land", "/join", "/communities/karen", "/sitemap.xml"];

const sitemap = await fetch(`${base}/sitemap.xml`).then((r) => r.text());
const listed = [...sitemap.matchAll(/<loc>[^<]*?(\/listings\/[^<]+)<\/loc>/g)].map((m) => m[1]);
const toCheck = routes.length > 0 ? routes : [...defaults, ...listed.slice(0, 3)];

const revalidated = await fetch(`${base}/api/revalidate`, {
  method: "POST",
  headers: { authorization: `Bearer ${secret}` },
});
if (revalidated.status !== 200) throw new Error(`Revalidate returned ${revalidated.status}`);

let failed = false;
for (const route of toCheck) {
  const { status } = await fetch(base + route);
  console.log(`${status === 200 ? "ok  " : "FAIL"} ${status} ${route}`);
  if (status !== 200) failed = true;
}
process.exit(failed ? 1 : 0);

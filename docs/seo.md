# Search and AI visibility

## What the site does

- Every public page has a canonical link, share tags, and is in `/sitemap.xml`. Staff and account pages are blocked.
- Blog posts and the homepage carry structured data that matches what's visible on the page.
- Search engines are blocked while `NEXT_PUBLIC_SITE_URL` is empty, and allowed once it's set.

## Connecting Google Search Console

1. In [Search Console](https://search.google.com/search-console), add a **URL prefix** property for the site's address.
2. Choose the **HTML tag** method and copy only the `content` value.
3. Set it as `GOOGLE_SITE_VERIFICATION` in Vercel and redeploy, then click **Verify**.
4. Under **Sitemaps**, submit `sitemap.xml`.
5. Use **URL Inspection** on the homepage and each post, and choose **Request indexing**.

## Writing posts that get found

Google says there's no special trick for AI answers, and that `llms.txt` and special markup make no difference. What helps is original, useful content.

- Put the question in the title and answer it directly in the first paragraph.
- Add what only you know: real prices seen, deals that went wrong, what members ask.
- State where facts come from, and keep tax and legal figures current.
- Don't mass-produce near-identical pages for keyword variations. Google treats that as spam.
- Add a "## Frequently asked questions" section with "### " questions. They become structured data automatically.

## Seeding posts

`pnpm seed-blogs` publishes the posts in `db/seed/blog-posts.mjs`, skipping any that exist. Because it writes straight to the database, the public pages won't show them until the next deploy. Posts approved in `/admin` appear immediately.

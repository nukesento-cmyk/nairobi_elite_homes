import { redirect } from "next/navigation";
import { Suspense } from "react";

import { logout } from "@/app/admin/actions";
import {
  ChangePasswordForm,
  CreateAdminForm,
  DeleteAdminForm,
  EditAdminForm,
  ResetPasswordForm,
} from "@/components/admin/AdminForms";
import { DeleteItem, PostManager, PropertyManager } from "@/components/admin/ContentForms";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { RequestRow, ReviewItem } from "@/components/admin/ReviewForms";
import { deletePostAction, deletePropertyAction } from "@/app/admin/content-actions";
import {
  canEdit,
  canManage,
  canManageContent,
  canRemoveContent,
  canReview,
  listAdmins,
  manageableRoles,
} from "@/lib/admin/accounts";
import { accessRequestStats, listAccessRequests } from "@/lib/access-requests";
import { getLiveSite } from "@/lib/cms";
import { liveContent, listPosts, listProperties, reviewQueue } from "@/lib/content";
import { formatPrice, formatSpecs } from "@/lib/listings";
import { chatWithNumber } from "@/lib/whatsapp";
import { db, getCurrentAdmin } from "@/lib/admin/session";

const ROLE_LABEL = { superadmin: "SuperAdmin", admin: "Admin", reviewer: "Reviewer" };

async function Dashboard() {
  const me = await getCurrentAdmin();
  if (!me) redirect("/admin/login");

  const header = (
    <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-4xl text-bone-50">{canManageContent(me) ? "Content" : "Dashboard"}</h1>
        <p className="mt-1 text-sm text-bone-200">
          {me.name} · {ROLE_LABEL[me.role]}
        </p>
      </div>
      <form action={logout}>
        <button type="submit" className="text-sm text-copper-400 underline underline-offset-4">
          Sign out
        </button>
      </form>
    </div>
  );

  if (me.mustChangePassword) {
    return (
      <>
        {header}
        <h2 className="mb-2 text-2xl text-bone-50">Choose your own password</h2>
        <p className="mb-6 text-bone-200">You&apos;re using a temporary password. Replace it to continue.</p>
        <ChangePasswordForm />
      </>
    );
  }

  const roles = manageableRoles(me);
  const accounts = await listAdmins(db, me);
  const [properties, posts] = canManageContent(me)
    ? await Promise.all([listProperties(db, me), listPosts(db, me)])
    : [[], []];

  const uploads = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const [requests, queue] = canReview(me)
    ? await Promise.all([listAccessRequests(db, me), reviewQueue(db, me)])
    : [[], { properties: [], posts: [] }];
  const live = canRemoveContent(me) && !canManageContent(me) ? await liveContent(db, me) : null;
  const stats = canReview(me) ? await accessRequestStats(db, me) : null;
  const monthlyPrice = (await getLiveSite()).community.paidPriceKes;
  const queueCount = queue.properties.length + queue.posts.length;
  const sections = [
    canReview(me) && { href: "#overview", label: "Overview" },
    canReview(me) && { href: "#requests", label: `Requests (${stats?.pending ?? 0})` },
    canReview(me) && { href: "#approvals", label: `Approvals (${queueCount})` },
    live && { href: "#live", label: "Live" },
    roles.length > 0 && { href: "#accounts", label: "Accounts" },
    { href: "#password", label: "Password" },
  ].filter((item) => item !== false && item !== null);

  return (
    <>
      {header}

      <nav aria-label="Dashboard sections" className="mb-10 flex flex-wrap gap-2 border-b border-border pb-4">
        {sections.map(({ href, label }) => (
          <a key={href} href={href} className="rounded-full border border-border px-4 py-1.5 text-sm text-bone-100 transition-colors hover:border-copper hover:text-copper-400">
            {label}
          </a>
        ))}
      </nav>

      {stats && <AdminOverview stats={stats} monthlyPrice={monthlyPrice} />}

      {canManageContent(me) && (
        <>
          <PropertyManager properties={properties} uploads={uploads} />
          <PostManager posts={posts} uploads={uploads} />
        </>
      )}

      {canReview(me) && (
        <div className="grid gap-x-10 lg:grid-cols-2 lg:items-start">
          <section id="requests" className="mb-14 scroll-mt-6 lg:order-1" aria-labelledby="requests-heading">
            <h2 id="requests-heading" className="mb-4 text-2xl text-bone-50">
              Requests to join ({stats?.pending ?? 0} waiting)
            </h2>
            {requests.length === 0 && <p className="text-bone-200">No requests yet.</p>}
            <ul className="space-y-3">
              {requests.map((request) => (
                <RequestRow
                  key={request.id}
                  request={{ ...request, createdAt: new Date(request.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }) }}
                  chatUrl={chatWithNumber(request.phone, `Hi ${request.name}, thanks for asking about the NairobiEliteHomes private community.`)}
                />
              ))}
            </ul>
          </section>

          <section id="approvals" className="mb-14 scroll-mt-6 lg:order-2" aria-labelledby="review-heading">
            <h2 id="review-heading" className="mb-4 text-2xl text-bone-50">
              Waiting for approval ({queue.properties.length + queue.posts.length})
            </h2>
            {queue.properties.length + queue.posts.length === 0 && <p className="text-bone-200">Nothing is waiting.</p>}
            <ul className="space-y-3">
              {queue.properties.map((item) => (
                <ReviewItem
                  key={item.id}
                  kind="property"
                  id={item.id}
                  title={item.title}
                  meta={[
                    `${item.area} · ${item.status.replace("_", " ")}`,
                    `Bread: ${formatPrice({ amount: Number(item.priceAmount), currency: item.priceCurrency, period: item.pricePeriod })}`,
                    formatSpecs({ beds: item.beds, baths: item.baths, acreage: item.acreage ? Number(item.acreage) : null, sqm: item.sqm }),
                  ].filter(Boolean)}
                  body={item.description}
                  photo={item.heroUrl}
                />
              ))}
              {queue.posts.map((item) => (
                <ReviewItem key={item.id} kind="post" id={item.id} title={item.title} meta={["Blog post", item.excerpt]} body={item.body} photo={item.coverUrl} />
              ))}
            </ul>
          </section>
        </div>
      )}

      {live && (
        <section id="live" className="mb-14 scroll-mt-6" aria-labelledby="live-heading">
          <h2 id="live-heading" className="mb-4 text-2xl text-bone-50">Live on the site</h2>
          {live.properties.length + live.posts.length === 0 && <p className="text-bone-200">Nothing yet.</p>}
          <ul className="space-y-3">
            {live.properties.map((item) => (
              <li key={item.id} data-live={item.title} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
                <span className="text-bone-50">{item.title}</span>
                <DeleteItem id={item.id} name={item.title} action={deletePropertyAction} />
              </li>
            ))}
            {live.posts.map((item) => (
              <li key={item.id} data-live={item.title} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
                <span className="text-bone-50">{item.title}</span>
                <DeleteItem id={item.id} name={item.title} action={deletePostAction} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {(roles.length > 0 || !canManageContent(me)) && (
        <section id="accounts" className="scroll-mt-6">
        <h2 className="mb-4 text-2xl text-bone-50">Accounts</h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {accounts.map((admin) => (
            <li key={admin.id} className="rounded-xl border border-border p-5">
              <p className="text-lg text-bone-50">
                {admin.name}
                {admin.id === me.id && <span className="text-bone-200"> (you)</span>}
              </p>
              <p className="text-sm text-bone-200">
                {admin.email} · {ROLE_LABEL[admin.role]}
              </p>
              {canEdit(me, admin) && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-copper-400">Edit</summary>
                  <div className="mt-4">
                    <EditAdminForm id={admin.id} name={admin.name} email={admin.email} />
                  </div>
                </details>
              )}
              {canManage(me, admin) && (
                <div className="mt-4 flex flex-wrap items-start gap-3">
                  <ResetPasswordForm id={admin.id} />
                  <DeleteAdminForm id={admin.id} name={admin.name} />
                </div>
              )}
            </li>
          ))}
        </ul>
        </section>
      )}

      {roles.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-2xl text-bone-50">
            {roles.length === 1 ? "Add a reviewer" : "Add an account"}
          </h2>
          <CreateAdminForm roles={roles} />
        </section>
      )}

      <section id="password" className="mt-12 scroll-mt-6">
        <h2 className="mb-4 text-2xl text-bone-50">Change your password</h2>
        <ChangePasswordForm />
      </section>
    </>
  );
}

export default function AdminPage() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}

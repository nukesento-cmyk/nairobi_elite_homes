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
import {
  BrandSettingsForm,
  CreateBrandForm,
  CreateGroupForm,
  CreateUserForm,
  DeleteGroupForm,
  DeleteUserForm,
  EditBrandForm,
  ResetUserPasswordForm,
} from "@/components/admin/BrandForms";
import { AcquisitionPanel } from "@/components/admin/AcquisitionPanel";
import { DeleteItem, PostManager, PropertyManager } from "@/components/admin/ContentForms";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { RequestRow, ReviewItem } from "@/components/admin/ReviewForms";
import { deletePostAction, deletePropertyAction } from "@/app/admin/content-actions";
import {
  canEdit,
  canManage,
  canManageGroups,
  canManageProperties,
  canManageUsers,
  canRemoveContent,
  canReview,
  canWritePosts,
  listAdmins,
  manageableRoles,
} from "@/lib/admin/accounts";
import { accessRequestStats, listAccessRequests } from "@/lib/access-requests";
import { emailSender, researchConfig } from "@/lib/acquisition/cron";
import { countDoNotContact, listLeads, listPendingDomains, listRecipients, listReports } from "@/lib/acquisition/dashboard";
import { isResearchEnabled } from "@/lib/acquisition/settings";
import { DEFAULT_BRAND_ID, listBrands, type Brand } from "@/lib/brands";
import { brandOrigin } from "@/lib/brand-site";
import { listUsers } from "@/lib/buyers";
import { getLiveSite } from "@/lib/cms";
import { liveContent, listPosts, listProperties, reviewQueue } from "@/lib/content";
import { formatPrice, formatSpecs } from "@/lib/listings";
import { chatWithNumber } from "@/lib/whatsapp";
import { listWhatsAppGroups } from "@/lib/whatsapp-groups";
import { db, getCurrentAdmin } from "@/lib/admin/session";

const ROLE_LABEL = { superadmin: "SuperAdmin", admin: "Admin", reviewer: "Reviewer" };

function siteAddress(brand: Brand): string {
  return brand.domain ? brandOrigin(brand.domain) : `/b/${brand.slug}`;
}

function BrandSiteLink({ brand }: { brand: Brand }) {
  return (
    <a href={siteAddress(brand)} target="_blank" rel="noopener noreferrer" className="text-sm text-copper-400 underline underline-offset-4">
      {brand.domain ?? `/b/${brand.slug}`}
    </a>
  );
}

async function Dashboard() {
  const me = await getCurrentAdmin();
  if (!me) redirect("/admin/login");

  const brands = await listBrands(db, me);
  const brandName = (id: string | null) => brands.find((brand) => brand.id === id)?.name ?? "";

  const header = (
    <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-4xl text-bone-50">{canReview(me) ? "Dashboard" : "Content"}</h1>
        <p className="mt-1 text-sm text-bone-200">
          {me.name} · {ROLE_LABEL[me.role]}
          {me.brandId && ` · ${brandName(me.brandId)}`}
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
  const [properties, posts] = await Promise.all([
    canManageProperties(me) ? listProperties(db, me) : [],
    canWritePosts(me) ? listPosts(db, me) : [],
  ]);
  const isSuperadmin = me.role === "superadmin";
  // The SuperAdmin works across brands, so has to say which. Nobody else ever gets the choice.
  const brandChoices = isSuperadmin ? brands : undefined;
  const [users, groups] = await Promise.all([
    canManageUsers(me) ? listUsers(db, me) : [],
    canManageGroups(me) ? listWhatsAppGroups(db, me) : [],
  ]);

  const researchSettings = researchConfig(process.env);
  const researchOn = isSuperadmin && (await isResearchEnabled(db, DEFAULT_BRAND_ID));
  const [acquisitionReports, reportRecipients, pendingDomains, acquisitionLeads, doNotContactCount] = isSuperadmin
    ? await Promise.all([
        listReports(db, me, DEFAULT_BRAND_ID),
        listRecipients(db, me, DEFAULT_BRAND_ID),
        listPendingDomains(db, me, DEFAULT_BRAND_ID),
        listLeads(db, me, DEFAULT_BRAND_ID),
        countDoNotContact(db, me),
      ])
    : [[], [], [], [], 0];

  const uploads = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const [requests, queue] = canReview(me)
    ? await Promise.all([listAccessRequests(db, me), reviewQueue(db, me)])
    : [[], { properties: [], posts: [] }];
  const live = canRemoveContent(me) && !canManageProperties(me) ? await liveContent(db, me) : null;
  const stats = canReview(me) ? await accessRequestStats(db, me) : null;
  const monthlyPrice = (await getLiveSite()).community.paidPriceKes;
  const queueCount = queue.properties.length + queue.posts.length;
  const sections = [
    isSuperadmin && { href: "#acquisition", label: `Acquisition (${acquisitionLeads.length})` },
    isSuperadmin && { href: "#brands", label: `Brands (${brands.length})` },
    canReview(me) && { href: "#overview", label: "Overview" },
    canManageProperties(me) && { href: "#properties", label: `Properties (${properties.length})` },
    canReview(me) && { href: "#requests", label: `Requests (${stats?.pending ?? 0})` },
    canReview(me) && { href: "#approvals", label: `Approvals (${queueCount})` },
    live && { href: "#live", label: "Live" },
    roles.length > 0 && { href: "#accounts", label: "Accounts" },
    canManageGroups(me) && { href: "#groups", label: `WhatsApp groups (${groups.length})` },
    canManageUsers(me) && { href: "#users", label: `Users (${users.length})` },
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

      {isSuperadmin && (
        <AcquisitionPanel
          reports={acquisitionReports}
          recipients={reportRecipients}
          emailReady={emailSender(process.env) !== null}
          researchOn={researchOn}
          researchMissing={researchSettings.state === "misconfigured" ? researchSettings.missing : []}
          domains={pendingDomains}
          leads={acquisitionLeads}
          doNotContactCount={doNotContactCount}
        />
      )}

      {isSuperadmin && (
        <section id="brands" className="mb-14 scroll-mt-6" aria-labelledby="brands-heading">
          <h2 id="brands-heading" className="mb-4 text-2xl text-bone-50">Brands</h2>
          <ul className="mb-6 grid gap-4 md:grid-cols-2">
            {brands.map((brand) => (
              <li key={brand.id} data-brand={brand.name} className="rounded-xl border border-border p-5">
                <p className="text-lg text-bone-50">{brand.name}</p>
                {brand.id === DEFAULT_BRAND_ID ? (
                  <p className="text-sm text-bone-200">The main site</p>
                ) : (
                  <BrandSiteLink brand={brand} />
                )}
                {brand.domain && (
                  <p className="mt-1 text-sm text-bone-200">
                    Its address only works once {brand.domain} is added to the Vercel project and its DNS points there. Until then, its site is at /b/{brand.slug}.
                  </p>
                )}
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-copper-400">Edit</summary>
                  <div className="mt-4">
                    <EditBrandForm id={brand.id} name={brand.name} domain={brand.domain} />
                  </div>
                </details>
                {brand.id !== DEFAULT_BRAND_ID && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm text-copper-400">Site details</summary>
                    <div className="mt-4">
                      <BrandSettingsForm brand={brand} uploads={uploads} />
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
          <details className="rounded-xl border border-border p-5">
            <summary className="cursor-pointer font-medium text-copper-400">Add a brand and its admin</summary>
            <div className="mt-5"><CreateBrandForm /></div>
          </details>
        </section>
      )}

      {me.role === "admin" && brands[0] && brands[0].id !== DEFAULT_BRAND_ID && (
        <section id="site" className="mb-14 scroll-mt-6 rounded-xl border border-border p-5" aria-labelledby="site-heading">
          <h2 id="site-heading" className="text-2xl text-bone-50">Your site</h2>
          <p className="mt-1 mb-4"><BrandSiteLink brand={brands[0]} /></p>
          <details>
            <summary className="cursor-pointer text-sm text-copper-400">Logo, colour and contact details</summary>
            <div className="mt-4">
              <BrandSettingsForm brand={brands[0]} uploads={uploads} />
            </div>
          </details>
        </section>
      )}

      {stats && <AdminOverview stats={stats} monthlyPrice={monthlyPrice} />}

      {canManageProperties(me) && <PropertyManager properties={properties} uploads={uploads} />}
      {canWritePosts(me) && <PostManager posts={posts} uploads={uploads} />}

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
                  chatUrl={chatWithNumber(request.phone, `Hi ${request.name}, thanks for asking about the ${brandName(request.brandId)} private community.`)}
                  groupLinks={groups
                    .filter((group) => group.brandId === request.brandId)
                    .map((group) => ({
                      name: group.name,
                      url: chatWithNumber(request.phone, `Hi ${request.name}, here's the link to join ${group.name}: ${group.url}`),
                    }))}
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
                    ...(isSuperadmin ? [brandName(item.brandId)] : []),
                    `${item.area} · ${item.status.replace("_", " ")}`,
                    `Bread: ${formatPrice({ amount: Number(item.priceAmount), currency: item.priceCurrency, period: item.pricePeriod })}`,
                    formatSpecs({ beds: item.beds, baths: item.baths, acreage: item.acreage ? Number(item.acreage) : null, sqm: item.sqm }),
                  ].filter(Boolean)}
                  body={item.description}
                  photo={item.heroUrl}
                />
              ))}
              {queue.posts.map((item) => (
                <ReviewItem key={item.id} kind="post" id={item.id} title={item.title} meta={[...(isSuperadmin ? [brandName(item.brandId)] : []), "Blog post", item.excerpt]} body={item.body} photo={item.coverUrl} />
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

      {roles.length > 0 && (
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
                {isSuperadmin && admin.brandId && ` · ${brandName(admin.brandId)}`}
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
          <h2 className="mb-4 text-2xl text-bone-50">Add an admin or reviewer</h2>
          <CreateAdminForm roles={roles} brands={brandChoices} />
        </section>
      )}

      {canManageGroups(me) && (
        <section id="groups" className="mt-12 scroll-mt-6" aria-labelledby="groups-heading">
          <h2 id="groups-heading" className="mb-4 text-2xl text-bone-50">WhatsApp groups</h2>
          <p className="mb-4 text-sm text-bone-200">
            Private to admins. Each one adds a &ldquo;Send link&rdquo; button to requests to join.
          </p>
          {groups.length === 0 && <p className="mb-4 text-bone-200">No groups yet.</p>}
          <ul className="mb-6 grid gap-4 md:grid-cols-2">
            {groups.map((group) => (
              <li key={group.id} data-group={group.name} className="rounded-xl border border-border p-5">
                <p className="text-lg text-bone-50">{group.name}</p>
                {isSuperadmin && <p className="text-sm text-bone-200">{brandName(group.brandId)}</p>}
                <p className="mt-1 text-sm break-all text-bone-200">{group.url}</p>
                <div className="mt-4"><DeleteGroupForm id={group.id} name={group.name} /></div>
              </li>
            ))}
          </ul>
          <CreateGroupForm brands={brandChoices} />
        </section>
      )}

      {canManageUsers(me) && (
        <section id="users" className="mt-12 scroll-mt-6" aria-labelledby="users-heading">
          <h2 id="users-heading" className="mb-4 text-2xl text-bone-50">Users</h2>
          {users.length === 0 && <p className="mb-4 text-bone-200">No users yet.</p>}
          <ul className="mb-6 grid gap-4 md:grid-cols-2">
            {users.map((user) => (
              <li key={user.id} data-user={user.email} className="rounded-xl border border-border p-5">
                <p className="text-lg text-bone-50">{user.name}</p>
                <p className="text-sm text-bone-200">
                  {user.email}
                  {user.signsInWithGoogle && " · Google"}
                  {isSuperadmin && ` · ${brandName(user.brandId)}`}
                </p>
                <div className="mt-4 flex flex-wrap items-start gap-3">
                  <ResetUserPasswordForm id={user.id} />
                  <DeleteUserForm id={user.id} name={user.name} />
                </div>
              </li>
            ))}
          </ul>
          <h3 className="mb-4 text-xl text-bone-50">Add a user</h3>
          <CreateUserForm brands={brandChoices} />
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

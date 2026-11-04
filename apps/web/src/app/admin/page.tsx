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
import { LeadsView, OptOutView, ReportsView, ResearchView } from "@/components/admin/AcquisitionPanel";
import { AdminShell, type ShellGroup, type ShellItem } from "@/components/admin/AdminShell";
import { AttentionList, Badge, Card, EmptyState, PageHeader, SectionTitle, Stat, type AttentionItem } from "@/components/admin/ui";
import { DeleteItem, PostManager, PropertyManager } from "@/components/admin/ContentForms";
import { OnboardingPanel } from "@/components/admin/OnboardingPanel";
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
import { missingDocumentSettings } from "@/lib/acquisition/document-store";
import { listOnboarding } from "@/lib/acquisition/onboarding";
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

const ROLE_LABEL = { superadmin: "SuperAdmin", admin: "Admin", reviewer: "Reviewer", caller: "Caller" };

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
      <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        {header}
        <h2 className="mb-2 text-2xl text-bone-50">Choose your own password</h2>
        <p className="mb-6 text-bone-200">You&apos;re using a temporary password. Replace it to continue.</p>
        <ChangePasswordForm />
      </main>
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

  const isCaller = me.role === "caller";
  const researchSettings = researchConfig(process.env);
  const researchOn = isSuperadmin && (await isResearchEnabled(db, DEFAULT_BRAND_ID));
  const [acquisitionReports, reportRecipients, pendingDomains, acquisitionLeads, doNotContactCount, onboardingCards] = isSuperadmin
    ? await Promise.all([
        listReports(db, me, DEFAULT_BRAND_ID),
        listRecipients(db, me, DEFAULT_BRAND_ID),
        listPendingDomains(db, me, DEFAULT_BRAND_ID),
        listLeads(db, me, DEFAULT_BRAND_ID),
        countDoNotContact(db, me),
        listOnboarding(db, me, DEFAULT_BRAND_ID),
      ])
    : isCaller
      ? [[], [], [], await listLeads(db, me, DEFAULT_BRAND_ID), await countDoNotContact(db, me), []]
      : [[], [], [], [], 0, []];

  const uploads = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const [requests, queue] = canReview(me)
    ? await Promise.all([listAccessRequests(db, me), reviewQueue(db, me)])
    : [[], { properties: [], posts: [] }];
  const live = canRemoveContent(me) && !canManageProperties(me) ? await liveContent(db, me) : null;
  const stats = canReview(me) ? await accessRequestStats(db, me) : null;
  const monthlyPrice = (await getLiveSite()).community.paidPriceKes;
  const queueCount = queue.properties.length + queue.posts.length;
  const followUpsDue = acquisitionLeads.filter((lead) => lead.followUpDue).length;
  const leadsToApprove = acquisitionLeads.filter((lead) => lead.status === "researched").length;
  const onboardingOpen = onboardingCards.filter((card) => !card.failedReason && !card.submittedAt).length;
  const lastReport = acquisitionReports[0];
  const attention: AttentionItem[] = [
    ...(isSuperadmin
      ? [
          { href: "#leads", label: "Follow-ups due", count: followUpsDue },
          { href: "#leads", label: "Leads to approve", count: leadsToApprove },
          { href: "#onboarding", label: "Owners being onboarded", count: onboardingOpen },
          { href: "#research", label: "Websites to review", count: pendingDomains.length },
          ...(lastReport?.status === "failed" ? [{ href: "#reports", label: "Latest report failed", count: 1, tone: "problem" as const }] : []),
        ]
      : []),
    { href: "#approvals", label: "Waiting for approval", count: queueCount },
    { href: "#requests", label: "Requests to join", count: stats?.pending ?? 0 },
  ];

  const home: ShellItem | false = (canReview(me) || isSuperadmin) && {
    id: "home",
    label: "Home",
    content: (
      <>
        <PageHeader title={`Welcome, ${me.name.split(" ")[0]}`} description="What needs you today." />
        <div className="mb-10"><AttentionList items={attention} /></div>
        {isSuperadmin && (
          <div className="mb-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Active leads" value={acquisitionLeads.length} />
            <Stat label="Research" value={researchOn ? "On" : "Off"} tone={researchOn ? "good" : "neutral"} />
            <Stat label="Do Not Contact" value={doNotContactCount} />
            <Stat label="Latest report" value={lastReport ? lastReport.runDate.slice(5) : "None"} note={lastReport ? (lastReport.status === "failed" ? "Failed" : lastReport.emailed ? "Emailed" : "On the dashboard") : undefined} tone={lastReport?.status === "failed" ? "problem" : "neutral"} />
          </div>
        )}
        {stats && <AdminOverview stats={stats} monthlyPrice={monthlyPrice} />}
      </>
    ),
  };

  const acquisition: ShellItem[] = isSuperadmin
    ? [
        { id: "leads", label: "Leads", count: followUpsDue + leadsToApprove || acquisitionLeads.length, urgent: followUpsDue + leadsToApprove > 0, content: <LeadsView leads={acquisitionLeads} /> },
        { id: "onboarding", label: "Onboarding", count: onboardingOpen, content: <OnboardingPanel cards={onboardingCards} missing={missingDocumentSettings(process.env)} uploads={uploads} /> },
        { id: "research", label: "Research", count: pendingDomains.length, urgent: pendingDomains.length > 0, content: <ResearchView researchOn={researchOn} researchMissing={researchSettings.state === "misconfigured" ? researchSettings.missing : []} domains={pendingDomains} /> },
        { id: "reports", label: "Morning reports", content: <ReportsView reports={acquisitionReports} recipients={reportRecipients} emailReady={emailSender(process.env) !== null} /> },
        { id: "do-not-contact", label: "Do Not Contact", content: <OptOutView count={doNotContactCount} /> },
      ]
    : [];

  const calling: ShellItem[] = isCaller
    ? [
        { id: "leads", label: "Call list", count: followUpsDue, urgent: followUpsDue > 0, content: <LeadsView leads={acquisitionLeads} callerView /> },
        { id: "do-not-contact", label: "Do Not Contact", content: <OptOutView count={doNotContactCount} /> },
      ]
    : [];

  const content: ShellItem[] = [
    ...(canManageProperties(me) ? [{ id: "properties", label: "Properties", count: properties.length, content: <PropertyManager properties={properties} uploads={uploads} /> }] : []),
    ...(canWritePosts(me) ? [{ id: "blog", label: "Blog", count: posts.length, content: <PostManager posts={posts} uploads={uploads} /> }] : []),
    ...(canReview(me)
      ? [{
          id: "approvals",
          label: "Approvals",
          count: queueCount,
          urgent: queueCount > 0,
          content: (
            <section aria-label="Approvals">
              <PageHeader title="Approvals" description="Nothing here is on the site until it's approved. A property from owner onboarding can't be approved by whoever verified its documents." />
              {queueCount === 0 && <EmptyState title="Nothing is waiting" />}
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
          ),
        }]
      : []),
    ...(live
      ? [{
          id: "live",
          label: "Live on the site",
          content: (
            <section aria-label="Live on the site">
              <PageHeader title="Live on the site" />
              {live.properties.length + live.posts.length === 0 && <EmptyState title="Nothing yet" />}
              <ul className="space-y-3">
                {live.properties.map((item) => (
                  <li key={item.id} data-live={item.title} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-forest-900/30 p-4">
                    <span className="text-bone-50">{item.title}</span>
                    <DeleteItem id={item.id} name={item.title} action={deletePropertyAction} />
                  </li>
                ))}
                {live.posts.map((item) => (
                  <li key={item.id} data-live={item.title} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-forest-900/30 p-4">
                    <span className="text-bone-50">{item.title}</span>
                    <DeleteItem id={item.id} name={item.title} action={deletePostAction} />
                  </li>
                ))}
              </ul>
            </section>
          ),
        }]
      : []),
  ];

  const community: ShellItem[] = [
    ...(canReview(me)
      ? [{
          id: "requests",
          label: "Requests to join",
          count: stats?.pending ?? 0,
          urgent: (stats?.pending ?? 0) > 0,
          content: (
            <section aria-label="Requests to join">
              <PageHeader title="Requests to join" description={`${stats?.pending ?? 0} waiting for a reply.`} />
              {requests.length === 0 && <EmptyState title="No requests yet" />}
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
          ),
        }]
      : []),
    ...(canManageGroups(me)
      ? [{
          id: "groups",
          label: "WhatsApp groups",
          count: groups.length,
          content: (
            <section aria-label="WhatsApp groups">
              <PageHeader title="WhatsApp groups" description="Private to admins. Each one adds a “Send link” button to requests to join." />
              {groups.length === 0 && <div className="mb-6"><EmptyState title="No groups yet" /></div>}
              <ul className="mb-6 grid gap-4 md:grid-cols-2">
                {groups.map((group) => (
                  <li key={group.id} data-group={group.name} className="rounded-xl border border-border bg-forest-900/30 p-5">
                    <p className="text-lg font-medium text-bone-50">{group.name}</p>
                    {isSuperadmin && <p className="text-sm text-bone-200">{brandName(group.brandId)}</p>}
                    <p className="mt-1 text-sm break-all text-bone-200">{group.url}</p>
                    <div className="mt-4"><DeleteGroupForm id={group.id} name={group.name} /></div>
                  </li>
                ))}
              </ul>
              <Card><SectionTitle>Add a group</SectionTitle><CreateGroupForm brands={brandChoices} /></Card>
            </section>
          ),
        }]
      : []),
    ...(canManageUsers(me)
      ? [{
          id: "users",
          label: "Users",
          count: users.length,
          content: (
            <section aria-label="Users">
              <PageHeader title="Users" description="Site visitors with a free account. They sign in at /login, and can't use this dashboard. For your team, add them under Staff accounts instead, with a role such as Caller." />
              {users.length === 0 && <div className="mb-6"><EmptyState title="No users yet" /></div>}
              <ul className="mb-6 grid gap-4 md:grid-cols-2">
                {users.map((user) => (
                  <li key={user.id} data-user={user.email} className="rounded-xl border border-border bg-forest-900/30 p-5">
                    <p className="text-lg font-medium text-bone-50">{user.name}</p>
                    <p className="text-sm break-all text-bone-200">
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
              <Card><SectionTitle>Add a user</SectionTitle><CreateUserForm brands={brandChoices} /></Card>
            </section>
          ),
        }]
      : []),
  ];

  const settings: ShellItem[] = [
    ...(isSuperadmin
      ? [{
          id: "brands",
          label: "Brands",
          count: brands.length,
          content: (
            <section aria-label="Brands">
              <PageHeader title="Brands" description="Each brand has its own site, staff and content." />
              <ul className="mb-6 grid gap-4 md:grid-cols-2">
                {brands.map((brand) => (
                  <li key={brand.id} data-brand={brand.name} className="rounded-xl border border-border bg-forest-900/30 p-5">
                    <p className="text-lg font-medium text-bone-50">{brand.name}</p>
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
                    <details className="mt-3">
                      <summary>Edit</summary>
                      <div className="mt-3"><EditBrandForm id={brand.id} name={brand.name} domain={brand.domain} /></div>
                    </details>
                    {brand.id !== DEFAULT_BRAND_ID && (
                      <details className="mt-1">
                        <summary>Site details</summary>
                        <div className="mt-3"><BrandSettingsForm brand={brand} uploads={uploads} /></div>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
              <Card>
                <details>
                  <summary>Add a brand and its admin</summary>
                  <div className="mt-4"><CreateBrandForm /></div>
                </details>
              </Card>
            </section>
          ),
        }]
      : []),
    ...(me.role === "admin" && brands[0] && brands[0].id !== DEFAULT_BRAND_ID
      ? [{
          id: "site",
          label: "Your site",
          content: (
            <section aria-label="Your site">
              <PageHeader title="Your site" description={<BrandSiteLink brand={brands[0]} />} />
              <Card><SectionTitle>Logo, colour and contact details</SectionTitle><BrandSettingsForm brand={brands[0]} uploads={uploads} /></Card>
            </section>
          ),
        }]
      : []),
    ...(roles.length > 0
      ? [{
          id: "accounts",
          label: "Staff accounts",
          count: accounts.length,
          content: (
            <section aria-label="Staff accounts">
              <PageHeader title="Staff accounts" description="Who can sign in to this dashboard, at /admin/login. Callers see only the call list: approved leads, logging calls and opt-outs." />
              <ul className="mb-6 grid gap-4 md:grid-cols-2">
                {accounts.map((admin) => (
                  <li key={admin.id} className="rounded-xl border border-border bg-forest-900/30 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-lg font-medium text-bone-50">
                        {admin.name}
                        {admin.id === me.id && <span className="font-normal text-bone-200"> (you)</span>}
                      </p>
                      <Badge>{ROLE_LABEL[admin.role]}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm break-all text-bone-200">
                      {admin.email}
                      {isSuperadmin && admin.brandId && ` · ${brandName(admin.brandId)}`}
                    </p>
                    {canEdit(me, admin) && (
                      <details className="mt-3">
                        <summary>Edit</summary>
                        <div className="mt-3"><EditAdminForm id={admin.id} name={admin.name} email={admin.email} /></div>
                      </details>
                    )}
                    {canManage(me, admin) && (
                      <div className="mt-3 flex flex-wrap items-start gap-3">
                        <ResetPasswordForm id={admin.id} />
                        <DeleteAdminForm id={admin.id} name={admin.name} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <Card><SectionTitle>Add an admin or reviewer</SectionTitle><CreateAdminForm roles={roles} brands={brandChoices} /></Card>
            </section>
          ),
        }]
      : []),
    {
      id: "password",
      label: "Your password",
      content: (
        <section aria-label="Your password">
          <PageHeader title="Your password" />
          <Card><ChangePasswordForm /></Card>
        </section>
      ),
    },
  ];

  const groupsForNav: ShellGroup[] = [
    { label: null, items: home ? [home] : [] },
    { label: "Acquisition", items: acquisition },
    { label: "Calling", items: calling },
    { label: "Content", items: content },
    { label: "Community", items: community },
    { label: "Settings", items: settings },
  ].filter((group) => group.items.length > 0);

  return (
    <AdminShell
      title="Nairobi Elite"
      groups={groupsForNav}
      person={
        <p className="truncate text-xs text-bone-200">
          {me.name} · {ROLE_LABEL[me.role]}
          {me.brandId && ` · ${brandName(me.brandId)}`}
        </p>
      }
      footer={
        <form action={logout}>
          <button type="submit" className="text-sm whitespace-nowrap text-bone-200 underline underline-offset-4 hover:text-bone-50">Sign out</button>
        </form>
      }
    />
  );
}

export default function AdminPage() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}

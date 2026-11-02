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
import { PostManager, PropertyManager } from "@/components/admin/ContentForms";
import {
  canEdit,
  canManage,
  canManageContent,
  listAdmins,
  manageableRoles,
} from "@/lib/admin/accounts";
import { listPosts, listProperties } from "@/lib/content";
import { db, getCurrentAdmin } from "@/lib/admin/session";

const ROLE_LABEL = { superadmin: "SuperAdmin", admin: "Admin", reviewer: "Reviewer" };

async function Dashboard() {
  const me = await getCurrentAdmin();
  if (!me) redirect("/admin/login");

  const header = (
    <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-4xl text-bone-50">{canManageContent(me) ? "Content" : "Accounts"}</h1>
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

  return (
    <>
      {header}

      {canManageContent(me) && (
        <>
          <PropertyManager properties={properties} />
          <PostManager posts={posts} />
        </>
      )}

      {(roles.length > 0 || !canManageContent(me)) && (
        <ul className="space-y-4">
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
      )}

      {roles.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-2xl text-bone-50">
            {roles.length === 1 ? "Add a reviewer" : "Add an account"}
          </h2>
          <CreateAdminForm roles={roles} />
        </section>
      )}

      <section className="mt-12">
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

import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { AdminRoleToggle } from "@/components/admin/admin-role-toggle";
import { AccountStatusActions } from "@/components/admin/account-status-actions";
import { ResetPasswordButton } from "@/components/admin/reset-password-button";
import styles from "@/components/admin/admin.module.css";
import { statusTone } from "@/components/admin/status-tone";
import { UserResults } from "@/components/admin/user-results";
import { Avatar, Chip, ScreenHeader, SectionHeader } from "@/components/ui";
import { getUserForAdmin, listUserResultsForAdmin } from "@/server/admin/users";
import { getCurrentUser } from "@/server/auth/current-user";
import { ForbiddenError, NotFoundError } from "@/server/auth/roles";

/**
 * Admin user page: account facts, status, password reset, the admin role switch and the user's
 * swim results with the exceptional admin revoke (S-72).
 */
export default async function AdminUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const actor = (await getCurrentUser()) ?? { id: "", isPlatformAdmin: false };
  const user = await getUserForAdmin(actor, userId).catch((err: unknown) => {
    if (err instanceof NotFoundError || err instanceof ForbiddenError) notFound();
    throw err;
  });
  const results = await listUserResultsForAdmin(actor, user.id);
  const t = await getTranslations("admin");
  const format = await getFormatter();
  return (
    <main className={styles.screen}>
      <div className={styles.headerBand}>
        <ScreenHeader
          title={user.displayName}
          backHref="/admin/users"
          backLabel={t("users.back")}
        />
      </div>
      <section aria-labelledby="account-title" className={styles.panel}>
        <SectionHeader id="account-title">{t("user.detailsTitle")}</SectionHeader>
        <div className={styles.panelBody}>
          <div className={styles.identity}>
            <Avatar name={user.displayName} size={56} decorative />
            <span className={styles.rowText}>
              <span className={styles.name}>{user.displayName}</span>
              <span className={styles.email}>{user.email}</span>
            </span>
          </div>
          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt>{t("user.status")}</dt>
              <dd>
                <Chip tone={statusTone(user.status)}>{t(`users.status.${user.status}`)}</Chip>
              </dd>
            </div>
            <div className={styles.fact}>
              <dt>{t("user.role")}</dt>
              <dd>
                <Chip tone={user.isPlatformAdmin ? "gold" : "neutral"}>
                  {t(user.isPlatformAdmin ? "users.role.admin" : "users.role.player")}
                </Chip>
              </dd>
            </div>
            <div className={styles.fact}>
              <dt>{t("user.joined")}</dt>
              <dd>{format.dateTime(new Date(user.createdAt), { dateStyle: "medium" })}</dd>
            </div>
          </dl>
        </div>
      </section>
      <AccountStatusActions
        key={user.status}
        userId={user.id}
        displayName={user.displayName}
        status={user.status}
      />
      {user.status !== "DELETED" && (
        <ResetPasswordButton userId={user.id} displayName={user.displayName} />
      )}
      <AdminRoleToggle
        key={String(user.isPlatformAdmin)}
        userId={user.id}
        displayName={user.displayName}
        isPlatformAdmin={user.isPlatformAdmin}
      />
      <UserResults results={results} displayName={user.displayName} />
    </main>
  );
}

import Link from "next/link";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import styles from "@/components/nav/app-nav.module.css";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { listMyTournaments } from "@/server/home/my-tournaments";

export default async function TournamentsPage() {
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/tournaments");
  const [t, tournaments] = await Promise.all([
    getTranslations("tabs.tournaments"),
    listMyTournaments(user.id, new Date()),
  ]);
  return (
    <main>
      <h1>{t("title")}</h1>
      <Link href="/tournaments/new" className={styles.tap}>
        {t("create")}
      </Link>
      {tournaments.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <ul>
          {tournaments.map((x) => (
            <li key={x.id}>
              {x.isOrganizer ? (
                <Link href={`/tournaments/${x.id}/manage`} className={styles.tap}>
                  {x.name}
                </Link>
              ) : (
                <span>{x.name}</span>
              )}{" "}
              <span>{t(`status.${x.effectiveStatus}`)}</span>
              {x.isOrganizer ? <strong> {t("organizer")}</strong> : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

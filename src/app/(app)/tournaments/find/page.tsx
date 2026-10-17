import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { MockupPicture } from "@/components/art/mockup-picture";
import { FindFilters } from "@/components/tournaments/find-filters";
import findStyles from "@/components/tournaments/find.module.css";
import styles from "@/components/tournaments/tournament-list.module.css";
import { ButtonLink, Card, Chip, SectionHeader, type ChipTone } from "@/components/ui";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { FIND_FILTERS, findHref, type FindFilter } from "@/lib/tournaments/find-params";
import { utcToVnParts } from "@/lib/time/vn";
import { requireUser } from "@/server/auth/current-user";
import { searchPublicTournaments, type PublicListStatus } from "@/server/tournaments/public-list";

const STATUS_TONE: Record<PublicListStatus, ChipTone> = {
  PUBLISHED: "info",
  ACTIVE: "success",
  COMPLETED: "gold",
};

/** Scene thumbnails from the G1 art registry (#703), as on the My tournaments list. */
const THUMB_KEYS = [
  "scenes/sea-island-day-4x3",
  "scenes/beach-da-nang-4x3",
  "scenes/sea-cu-lao-cham-4x3",
  "scenes/sea-ly-son-4x3",
  "scenes/sunrise-coast-4x3",
] as const;

function vnDate(d: Date): string {
  const [y, m, day] = utcToVnParts(new Date(d)).date.split("-");
  return `${day}/${m}/${y}`;
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Find tournaments: public tournaments by name and status, 20 per page. */
export default async function FindTournamentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = first(sp.q).trim().slice(0, 100);
  const statusParam = first(sp.status).toUpperCase();
  const filter: FindFilter = (FIND_FILTERS as readonly string[]).includes(statusParam)
    ? (statusParam as FindFilter)
    : "open";
  const cursor = first(sp.cursor);
  await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/tournaments/find");
  const [t, page] = await Promise.all([
    getTranslations("find"),
    searchPublicTournaments({ q, status: filter === "open" ? undefined : filter, cursor }),
  ]);

  return (
    <main className={styles.screen}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t("title")}</h1>
        <ButtonLink href="/tournaments" size="sm" variant="secondary">
          {t("back")}
        </ButtonLink>
      </div>
      <section className={styles.panel} aria-labelledby="find-list-title">
        <div className={styles.panelHeader}>
          <SectionHeader id="find-list-title">{t("listTitle")}</SectionHeader>
        </div>
        <Card className={styles.card}>
          <div className={styles.list}>
            <FindFilters q={q} filter={filter} />
            {page.items.length === 0 ? (
              <div className={findStyles.emptyBox}>
                <p className={styles.empty}>{t("empty")}</p>
                <p className={styles.dates}>{t("emptyHint")}</p>
                {q || filter !== "open" ? (
                  <ButtonLink href="/tournaments/find" size="sm" variant="secondary">
                    {t("clear")}
                  </ButtonLink>
                ) : null}
              </div>
            ) : (
              <ul className={styles.rows}>
                {page.items.map((x, i) => (
                  <li key={x.id} className={styles.row}>
                    <MockupPicture
                      artKey={THUMB_KEYS[i % THUMB_KEYS.length]}
                      alt=""
                      className={styles.thumb}
                      fallback={<span className={styles.thumb} aria-hidden="true" />}
                    />
                    <div className={styles.body}>
                      <h3 className={styles.name}>{x.name}</h3>
                      <p className={styles.dates}>
                        {t("dates", { start: vnDate(x.seasonStartAt), end: vnDate(x.seasonEndAt) })}
                      </p>
                      {x.status !== "COMPLETED" ? (
                        <p className={findStyles.places}>
                          {t("placesLeft", { count: x.freePlaces })}
                        </p>
                      ) : null}
                      <div className={styles.footer}>
                        <div className={styles.chips}>
                          <Chip tone={STATUS_TONE[x.status]}>{t(`status.${x.status}`)}</Chip>
                        </div>
                        <ButtonLink
                          size="sm"
                          variant={x.status === "COMPLETED" ? "secondary" : "primary"}
                          href={
                            x.status === "COMPLETED"
                              ? `/tournaments/${x.id}`
                              : `/tournaments/${x.id}/join`
                          }
                          className={styles.action}
                        >
                          {x.status === "COMPLETED" ? t("details") : t("join")}
                          <span className={styles.visuallyHidden}>: {x.name}</span>
                        </ButtonLink>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {page.nextCursor ? (
              <ButtonLink
                href={findHref(q, filter, page.nextCursor)}
                variant="secondary"
                size="sm"
                className={findStyles.more}
              >
                {t("more")}
              </ButtonLink>
            ) : null}
          </div>
        </Card>
      </section>
    </main>
  );
}

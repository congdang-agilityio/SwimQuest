import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MockupPicture } from "@/components/art/mockup-picture";
import { FinishCard } from "@/components/finish/finish-card";
import styles from "@/components/finish/finish-card.module.css";
import { WELCOME_PATH } from "@/lib/auth/public-paths";
import { getPublicFinish } from "@/server/finish/share";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const finish = await getPublicFinish((await params).token);
  if (!finish) return {};
  const [t, tAll] = await Promise.all([getTranslations("share"), getTranslations()]);
  const team = finish.team.name;
  const place = finish.route.finishKey ? tAll(finish.route.finishKey) : "";
  if (!finish.finished) return { title: t("lostMetaTitle", { team }), robots: { index: false } };
  const title = t("metaTitle", { team, place });
  const description = t("metaDescription", { team, place, tournament: finish.tournamentName });
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, type: "website" },
  };
}

/**
 * Public finish page (S-82): anyone with the share link sees the team's finish, signed in or not.
 * Outside the app shell; shows only `getPublicFinish` data.
 */
export default async function PublicFinishPage({ params }: Props) {
  const finish = await getPublicFinish((await params).token);
  if (!finish) notFound();
  const tc = await getTranslations("common");
  return (
    <main className={styles.page}>
      <Link href={WELCOME_PATH} className={styles.brand}>
        <MockupPicture artKey="brand/logo" alt={tc("appName")} eager fallback={tc("appName")} />
      </Link>
      <FinishCard finish={finish} />
    </main>
  );
}

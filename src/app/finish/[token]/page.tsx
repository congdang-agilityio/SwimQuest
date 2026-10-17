import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MockupPicture } from "@/components/art/mockup-picture";
import { FinishCard } from "@/components/finish/finish-card";
import styles from "@/components/finish/finish-card.module.css";
import { WELCOME_PATH } from "@/lib/auth/public-paths";
import { getPublicFinish } from "@/server/finish/share";

/** Absolute base for the `og:image` URL: the trusted `APP_URL`, when set. */
function metadataBase(): URL | undefined {
  try {
    return process.env.APP_URL ? new URL(process.env.APP_URL) : undefined;
  } catch {
    return undefined;
  }
}

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const finish = await getPublicFinish(token);
  if (!finish) return {};
  const [t, tAll] = await Promise.all([getTranslations("share"), getTranslations()]);
  const team = finish.team.name;
  const place = finish.route.finishKey ? tAll(finish.route.finishKey) : "";
  if (!finish.finished) return { title: t("lostMetaTitle", { team }), robots: { index: false } };
  const title = t("metaTitle", { team, place });
  const image = { url: `/finish/${token}/image`, width: 1080, height: 1080, alt: title };
  const description = t("metaDescription", { team, place, tournament: finish.tournamentName });
  return {
    title,
    description,
    robots: { index: false },
    metadataBase: metadataBase(),
    openGraph: { title, description, type: "website", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
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

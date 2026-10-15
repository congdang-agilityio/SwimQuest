import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function ProfilePage() {
  const t = await getTranslations("nav");
  return (
    <main>
      <h1>{t("profile.title")}</h1>
      <p>
        <Link href="/swims" style={{ display: "inline-block", padding: "12px 0" }}>
          {t("profile.mySwims")}
        </Link>
      </p>
      <LogoutButton />
    </main>
  );
}

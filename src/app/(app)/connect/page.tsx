import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { UploadForm } from "@/components/swims/upload-form";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";

export default async function ConnectPage() {
  const [h, t] = [await headers(), await getTranslations("swims.connect")];
  await requireUser(h.get(NEXT_PATH_HEADER) ?? "/connect");
  return (
    <main>
      <h1>{t("title")}</h1>
      <UploadForm />
    </main>
  );
}

import { getTranslations } from "next-intl/server";
import { UploadForm } from "@/components/swims/upload-form";

export default async function ConnectPage() {
  const t = await getTranslations("swims.connect");
  return (
    <main>
      <h1>{t("title")}</h1>
      <UploadForm />
    </main>
  );
}

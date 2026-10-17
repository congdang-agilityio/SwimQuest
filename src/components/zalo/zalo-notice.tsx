import { getTranslations } from "next-intl/server";
import { MockupPicture } from "@/components/art/mockup-picture";
import { Card } from "@/components/ui";
import { isZaloGroupLinked } from "@/server/zalo/settings";
import styles from "./zalo-notice.module.css";

/**
 * Tells players that the tournament posts members' names and counted swims to its Zalo group
 * (S-89 AC 5). Renders nothing when the tournament has no linked group; reads a boolean only.
 */
export async function ZaloNotice({ tournamentId }: { tournamentId: string }) {
  if (!(await isZaloGroupLinked(tournamentId))) return null;
  const t = await getTranslations("zalo");
  return (
    <Card role="note" className={styles.notice} data-testid="zalo-notice">
      <MockupPicture artKey="items/message-bottle" alt="" className={styles.art} />
      <p>{t("playerNotice")}</p>
    </Card>
  );
}

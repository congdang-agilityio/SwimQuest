import { getTranslations } from "next-intl/server";
import styles from "./audit.module.css";

type Flat = Map<string, string>;
const ROOT = "";

/** Flattens nested objects to dotted paths; arrays and scalars become JSON text. */
function flatten(value: unknown, path = ROOT, out: Flat = new Map()): Flat {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value);
    if (entries.length) {
      for (const [k, v] of entries) flatten(v, path ? `${path}.${k}` : k, out);
      return out;
    }
  }
  out.set(path, typeof value === "string" ? value : JSON.stringify(value));
  return out;
}

/**
 * Old and new values field by field. Values are rendered as escaped text only. Changed
 * fields are marked with the word "Changed", not by colour alone. A missing side shows "none".
 */
export async function AuditDiff({ before, after }: { before: unknown; after: unknown }) {
  const t = await getTranslations("admin.audit.detail");
  const old = before == null ? null : flatten(before);
  const next = after == null ? null : flatten(after);
  const fields = [...new Set([...(old?.keys() ?? []), ...(next?.keys() ?? [])])];
  const none = <em className={styles.none}>{t("none")}</em>;
  const cell = (side: Flat | null, field: string) =>
    side?.has(field) ? <code className={styles.value}>{side.get(field)}</code> : none;
  return (
    <div className={styles.panel}>
      <table className={styles.table}>
        <caption className={styles.srOnly}>{t("changes")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("field")}</th>
            <th scope="col">{t("old")}</th>
            <th scope="col">{t("new")}</th>
            <th scope="col">{t("status")}</th>
          </tr>
        </thead>
        <tbody>
          {fields.length ? (
            fields.map((f) => {
              const changed = old?.get(f) !== next?.get(f);
              return (
                <tr key={f} data-changed={changed || undefined}>
                  <td data-label={t("field")}>{f || t("value")}</td>
                  <td data-label={t("old")}>{cell(old, f)}</td>
                  <td data-label={t("new")}>{cell(next, f)}</td>
                  <td data-label={t("status")}>
                    <strong>{changed ? t("changed") : t("unchanged")}</strong>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={4}>{t("noValues")}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

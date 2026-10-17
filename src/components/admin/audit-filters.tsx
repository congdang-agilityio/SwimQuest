import { getTranslations } from "next-intl/server";
import { Button, ButtonLink, Field, SelectField } from "@/components/ui";
import { auditActionLabel } from "./audit-labels";
import styles from "./audit.module.css";

type Values = { tournament: string; user: string; action: string; from: string; to: string };

/** GET form: the filters become query parameters, so they survive paging and reloads. */
export async function AuditFilters({
  tournaments,
  actions,
  values,
}: {
  tournaments: { id: string; name: string }[];
  actions: string[];
  values: Values;
}) {
  const t = await getTranslations("admin.audit");
  const all = <option value="">{t("filters.any")}</option>;
  return (
    <form
      method="get"
      action="/admin/audit"
      className={styles.filters}
      aria-label={t("filters.title")}
    >
      <SelectField
        id="audit-tournament"
        name="tournament"
        label={t("filters.tournament")}
        defaultValue={values.tournament}
      >
        {all}
        {tournaments.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </SelectField>
      <SelectField
        id="audit-action"
        name="action"
        label={t("filters.action")}
        defaultValue={values.action}
      >
        {all}
        {actions.map((a) => (
          <option key={a} value={a}>
            {auditActionLabel(t, a)}
          </option>
        ))}
      </SelectField>
      <Field
        id="audit-user"
        name="user"
        label={t("filters.user")}
        hint={t("filters.userHint")}
        defaultValue={values.user}
        maxLength={100}
      />
      <Field
        id="audit-from"
        name="from"
        type="date"
        label={t("filters.from")}
        defaultValue={values.from}
      />
      <Field id="audit-to" name="to" type="date" label={t("filters.to")} defaultValue={values.to} />
      <div className={styles.filterActions}>
        <Button type="submit">{t("filters.apply")}</Button>
        <ButtonLink variant="ghost" href="/admin/audit">
          {t("filters.clear")}
        </ButtonLink>
      </div>
    </form>
  );
}

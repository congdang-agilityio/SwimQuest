type T = ((key: string) => string) & { has: (key: string) => boolean };

/** Readable action name, or the raw name when there is no label for it. */
export function auditActionLabel(t: T, action: string): string {
  return t.has(`actions.${action}`) ? t(`actions.${action}`) : action;
}

/** Readable target type, or the raw type when there is no label for it. */
export function auditEntityLabel(t: T, entityType: string): string {
  return t.has(`entities.${entityType}`) ? t(`entities.${entityType}`) : entityType;
}

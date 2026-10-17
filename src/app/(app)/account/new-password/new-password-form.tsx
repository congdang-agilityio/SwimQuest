"use client";

import { ChangePasswordForm } from "@/components/profile/change-password-form";

/** The change-password form; on success the flag is cleared, so a full load of Home is safe. */
export function NewPasswordForm() {
  return <ChangePasswordForm onDone={() => window.location.assign("/")} />;
}

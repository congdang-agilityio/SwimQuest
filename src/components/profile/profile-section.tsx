"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import type { MyProfile } from "@/server/profile/my-profile";
import { ProfileEditForm } from "./profile-edit-form";
import { ProfileView } from "./profile-view";

/** Switches My Profile between view and edit mode; a save returns to view mode with new values. */
export function ProfileSection({ profile: initial }: { profile: MyProfile }) {
  const router = useRouter();
  const [profile, setProfile] = useState(initial);
  const [editing, setEditing] = useState(false);
  if (!editing) return <ProfileView profile={profile} onEdit={() => setEditing(true)} />;
  return (
    <Card as="section">
      <ProfileEditForm
        profile={profile}
        onCancel={() => setEditing(false)}
        onSaved={(saved) => {
          setProfile(saved);
          setEditing(false);
          router.refresh();
        }}
      />
    </Card>
  );
}

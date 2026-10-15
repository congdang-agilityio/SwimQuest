import type { ReactNode } from "react";

/** Centred card shared by the login and sign-up pages. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>{children}</div>
    </main>
  );
}

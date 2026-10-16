import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import states from "../../../../messages/en/states.json";

const state = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/auth/current-user", () => ({ getCurrentUser: state.getCurrentUser }));

const { default: AdminLayout } = await import("./layout");

async function html(): Promise<string> {
  const tree = await AdminLayout({ children: <p>admin content</p> });
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={{ states }}>
      {tree}
    </NextIntlClientProvider>,
  );
}

describe("admin layout", () => {
  beforeEach(() => state.getCurrentUser.mockReset());

  it("renders the children for a platform admin", async () => {
    state.getCurrentUser.mockResolvedValue({ id: "a", displayName: "A", isPlatformAdmin: true });
    const out = await html();
    expect(out).toContain("admin content");
    expect(out).not.toContain("You do not have access");
  });

  it("shows access denied with a way home to a player", async () => {
    state.getCurrentUser.mockResolvedValue({ id: "p", displayName: "P", isPlatformAdmin: false });
    const out = await html();
    expect(out).not.toContain("admin content");
    expect(out).toContain("You do not have access");
    expect(out).toContain('href="/"');
  });

  it("shows access denied without a user", async () => {
    state.getCurrentUser.mockResolvedValue(null);
    expect(await html()).toContain("You do not have access");
  });
});

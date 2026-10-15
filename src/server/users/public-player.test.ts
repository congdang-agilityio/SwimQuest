import { describe, expect, expectTypeOf, it } from "vitest";
import { PUBLIC_PLAYER_SELECT, toPublicPlayer, type PublicPlayer } from "./public-player";

describe("toPublicPlayer", () => {
  it("keeps only the id and display name", () => {
    const user = {
      id: "u1",
      displayName: "Lan",
      email: "lan@example.com",
      passwordHash: "secret-hash",
      status: "ACTIVE",
      isPlatformAdmin: false,
    };

    const player = toPublicPlayer(user);

    expect(player).toEqual({ id: "u1", displayName: "Lan" });
    expect(Object.keys(player).sort()).toEqual(["displayName", "id"]);
    expect(player).not.toHaveProperty("email");
    expect(player).not.toHaveProperty("passwordHash");
    expect(player).not.toHaveProperty("status");
  });

  it("returns a new object, not the input user", () => {
    const user = { id: "u2", displayName: "Minh", email: "minh@example.com" };

    expect(toPublicPlayer(user)).not.toBe(user);
  });
});

describe("PUBLIC_PLAYER_SELECT", () => {
  it("selects only id and displayName", () => {
    expect(PUBLIC_PLAYER_SELECT).toEqual({ id: true, displayName: true });
  });
});

describe("PublicPlayer type", () => {
  it("has only id and displayName, so email cannot be included", () => {
    expectTypeOf<keyof PublicPlayer>().toEqualTypeOf<"id" | "displayName">();
    expectTypeOf<PublicPlayer>().not.toHaveProperty("email");
    expectTypeOf(toPublicPlayer).returns.toEqualTypeOf<PublicPlayer>();
  });
});

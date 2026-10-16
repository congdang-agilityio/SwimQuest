import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";

async function clean() {
  await db.user.updateMany({ data: { avatarImageId: null, coverImageId: null } });
  await db.imageAsset.deleteMany();
  await db.pointsEntry.deleteMany();
  await db.swimResult.deleteMany();
  await db.swim.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

function createUser(email = "player@example.com") {
  return db.user.create({ data: { email, passwordHash: "hash", displayName: "Player" } });
}

describe("player profile and image schema", () => {
  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("gives an existing user empty profile defaults", async () => {
    const { id } = await createUser();

    const user = await db.user.findUniqueOrThrow({ where: { id } });
    expect(user).toMatchObject({
      avatarImageId: null,
      avatarDefaultKey: null,
      coverImageId: null,
      bio: null,
      regionCode: null,
      goalsText: null,
      goalDistanceM: null,
      disciplines: [],
      privacy: {},
      locale: null,
    });
  });

  it("stores profile fields and links avatar and cover images", async () => {
    const owner = await createUser();
    const avatar = await db.imageAsset.create({
      data: {
        ownerId: owner.id,
        kind: "AVATAR",
        mime: "image/png",
        bytes: Buffer.from([1]),
        sizeBytes: 1,
      },
    });
    const cover = await db.imageAsset.create({
      data: {
        ownerId: owner.id,
        kind: "COVER",
        mime: "image/jpeg",
        bytes: Buffer.from([2]),
        sizeBytes: 1,
      },
    });

    const user = await db.user.update({
      where: { id: owner.id },
      data: {
        avatarImageId: avatar.id,
        coverImageId: cover.id,
        bio: "Open water lover",
        regionCode: "VN-HN",
        goalsText: "Swim 100 km",
        goalDistanceM: 100000,
        disciplines: ["OPEN_WATER", "POOL"],
        privacy: { bio: "PUBLIC" },
        locale: "vi",
      },
      include: { avatarImage: true, coverImage: true },
    });
    expect(user.avatarImage?.kind).toBe("AVATAR");
    expect(user.coverImage?.kind).toBe("COVER");
    expect(user).toMatchObject({ disciplines: ["OPEN_WATER", "POOL"], privacy: { bio: "PUBLIC" } });
  });

  it("refuses a region value that looks like an address", async () => {
    const { id } = await createUser();

    await expect(
      db.user.update({ where: { id }, data: { regionCode: "12 Ly Thuong Kiet, Hanoi" } }),
    ).rejects.toThrow();
  });

  it("round-trips the bytes of an image asset", async () => {
    const owner = await createUser();
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x10]);

    const { id } = await db.imageAsset.create({
      data: {
        ownerId: owner.id,
        kind: "TOURNAMENT_BANNER",
        mime: "image/png",
        bytes,
        sizeBytes: bytes.length,
      },
    });

    const image = await db.imageAsset.findUniqueOrThrow({ where: { id } });
    expect(Buffer.from(image.bytes).equals(bytes)).toBe(true);
    expect(image).toMatchObject({
      ownerId: owner.id,
      kind: "TOURNAMENT_BANNER",
      mime: "image/png",
      sizeBytes: 7,
    });
    expect(image.createdAt).toBeInstanceOf(Date);
  });

  it("clears the avatar link when its image is deleted", async () => {
    const owner = await createUser();
    const avatar = await db.imageAsset.create({
      data: {
        ownerId: owner.id,
        kind: "AVATAR",
        mime: "image/webp",
        bytes: Buffer.from([3]),
        sizeBytes: 1,
      },
    });
    await db.user.update({ where: { id: owner.id }, data: { avatarImageId: avatar.id } });

    await db.imageAsset.delete({ where: { id: avatar.id } });

    const user = await db.user.findUniqueOrThrow({ where: { id: owner.id } });
    expect(user.avatarImageId).toBeNull();
  });
});

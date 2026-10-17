import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getFormatter, getTranslations } from "next-intl/server";
import { mockupArt } from "@/lib/art/mockup-art";
import { emblemPath, isEmblemKey } from "@/lib/emblems";
import { getPublicFinish } from "@/server/finish/share";

export const runtime = "nodejs";

const SIZE = 1080;
// The picture cannot read CSS variables: these mirror tokens.css (navy-950/900, gold-strong,
// text-on-dark, text-on-dark-muted).
const NAVY_950 = "#011a31";
const NAVY_900 = "#01213d";
const GOLD = "#f5ca30";
const WHITE = "#ffffff";
const MUTED = "#b8cfe6";
// Temporary cut from the mockup until the G2 badge set (#704) has the HOÀN THÀNH emblem.
const FINISH_EMBLEM = "/art/mockup/screen-finish/finish-emblem.png";

const MIME: Record<string, string> = { ".png": "image/png", ".svg": "image/svg+xml" };

/** A file under `public/` as a data URL (PNG or SVG; the renderer has no WebP), or null. */
async function publicDataUrl(url: string | undefined): Promise<string | null> {
  if (!url) return null;
  const file = url.replace(/\.webp$/, ".png");
  const mime = MIME[path.extname(file)];
  if (!mime || file.includes("..")) return null;
  try {
    const data = await readFile(path.join(process.cwd(), "public", file));
    return `data:${mime};base64,${data.toString("base64")}`;
  } catch {
    return null;
  }
}

/** The team emblem (registry art, else `public/art/emblems/<key>.svg`), or null. */
async function emblemDataUrl(key: string): Promise<string | null> {
  if (!isEmblemKey(key)) return null;
  return (await publicDataUrl(emblemPath(key))) ?? (await publicDataUrl(`/art/emblems/${key}.svg`));
}

const font = (file: string) => readFile(path.join(process.cwd(), "assets/fonts", file));

/**
 * The finish picture (S-82): 1080 x 1080 PNG with the team name and emblem, route, finish date,
 * team total, the HOÀN THÀNH emblem and the SwimQuest logo. No player details at all. Unknown
 * tokens and lost finishes are 404 (no picture of a withdrawn finish).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const finish = await getPublicFinish((await params).token);
  if (!finish || !finish.finished || !finish.finishedAt) {
    return new Response("Not found", { status: 404 });
  }

  const [t, tAll, format, bold, extraBold, scene, logo, badge, emblem] = await Promise.all([
    getTranslations("share"),
    getTranslations(),
    getFormatter(),
    font("BeVietnamPro-Bold.ttf"),
    font("BeVietnamPro-ExtraBold.ttf"),
    publicDataUrl(mockupArt("scenes/sea-ly-son-4x3")?.file),
    publicDataUrl(mockupArt("brand/logo")?.file),
    publicDataUrl(FINISH_EMBLEM),
    emblemDataUrl(finish.team.emblemKey),
  ]);
  const name = (key: string | null) => (key ? tAll(key) : "");
  const place = name(finish.route.finishKey);
  const start = name(finish.route.startKey);
  const team = finish.team.name;
  const date = format.dateTime(finish.finishedAt, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const km = t("km", { km: format.number(finish.totalM / 1000, { maximumFractionDigits: 1 }) });
  const points = t("points", { points: format.number(finish.points) });
  const route =
    start && place ? t("routeLeg", { start, finish: place }) : name(finish.route.nameKey);

  const image = (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: SIZE,
        height: SIZE,
        backgroundImage: `linear-gradient(180deg, ${NAVY_900} 0%, ${NAVY_950} 100%)`,
        color: WHITE,
        fontFamily: "Be Vietnam Pro",
      }}
    >
      {scene && (
        // eslint-disable-next-line @next/next/no-img-element -- rendered to PNG by next/og
        <img
          src={scene}
          alt=""
          width={SIZE}
          height={SIZE * 0.62}
          style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }}
        />
      )}
      {/* The scene's lower edge melts into the navy band (as on the finish panel). */}
      <div
        style={{
          position: "absolute",
          top: SIZE * 0.3,
          left: 0,
          width: SIZE,
          height: SIZE * 0.33,
          display: "flex",
          backgroundImage: `linear-gradient(180deg, rgba(1,33,61,0) 0%, ${NAVY_900} 100%)`,
        }}
      />
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element -- rendered to PNG by next/og
        <img
          src={logo}
          alt=""
          width={300}
          height={207}
          style={{ marginTop: 28, objectFit: "contain" }}
        />
      )}
      {badge && (
        // eslint-disable-next-line @next/next/no-img-element -- rendered to PNG by next/og
        <img src={badge} alt="" width={387} height={331} style={{ marginTop: 40 }} />
      )}
      <div style={{ display: "flex", marginTop: 20, fontSize: 64, fontWeight: 800, color: GOLD }}>
        {t("title", { place })}
      </div>
      <div style={{ display: "flex", alignItems: "center", marginTop: 20, gap: 24 }}>
        {emblem ? (
          // eslint-disable-next-line @next/next/no-img-element -- rendered to PNG by next/og
          <img src={emblem} alt="" width={96} height={96} style={{ objectFit: "contain" }} />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 96,
              height: 96,
              borderRadius: 48,
              background: WHITE,
              color: NAVY_900,
              fontSize: 52,
              fontWeight: 800,
            }}
          >
            {team.trim().charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ display: "flex", fontSize: 56, fontWeight: 800, maxWidth: 820 }}>{team}</div>
      </div>
      <div style={{ display: "flex", marginTop: 16, fontSize: 34, fontWeight: 700, color: MUTED }}>
        {`${route} · ${date}`}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", marginTop: 18, gap: 28 }}>
        <div style={{ display: "flex", fontSize: 60, fontWeight: 800, color: GOLD }}>{km}</div>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>{points}</div>
      </div>
    </div>
  );

  return new ImageResponse(image, {
    width: SIZE,
    height: SIZE,
    fonts: [
      { name: "Be Vietnam Pro", data: bold, weight: 700, style: "normal" },
      { name: "Be Vietnam Pro", data: extraBold, weight: 800, style: "normal" },
    ],
    headers: { "Cache-Control": "public, max-age=300" },
  });
}

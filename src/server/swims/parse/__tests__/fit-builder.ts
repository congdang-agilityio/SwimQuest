import { FitBaseType, FitEncoder } from "fit-file-parser";

type Opts = {
  sport: number; // 1 running, 5 swimming
  subSport: number; // 0 generic, 17 lap_swimming, 18 open_water
  start: Date;
  timerS?: number;
  distanceM?: number;
  points?: { lat: number; lon: number; at: Date }[];
  withSession?: boolean;
};

const SEMI = 2 ** 31 / 180;
const f = (number: number, baseType: FitBaseType, value: number, size = 4) => ({
  number,
  size,
  baseType,
  value,
});

/** Builds a small valid FIT activity file with the package's own encoder. */
export function buildFit(o: Opts): Buffer {
  const enc = new FitEncoder();
  const ts = FitEncoder.toFitTimestamp;
  enc.writeMessage(0, [f(0, FitBaseType.Enum, 4, 1), f(253, FitBaseType.Uint32, ts(o.start))], 0);
  for (const p of o.points ?? []) {
    enc.writeMessage(
      20,
      [
        f(253, FitBaseType.Uint32, ts(p.at)),
        f(0, FitBaseType.Sint32, Math.round(p.lat * SEMI)),
        f(1, FitBaseType.Sint32, Math.round(p.lon * SEMI)),
      ],
      1,
    );
  }
  if (o.withSession !== false) {
    const fields = [
      f(253, FitBaseType.Uint32, ts(o.start)),
      f(2, FitBaseType.Uint32, ts(o.start)),
      f(5, FitBaseType.Enum, o.sport, 1),
      f(6, FitBaseType.Enum, o.subSport, 1),
      f(7, FitBaseType.Uint32, (o.timerS ?? 0) * 1000),
      f(8, FitBaseType.Uint32, (o.timerS ?? 0) * 1000),
      f(9, FitBaseType.Uint32, (o.distanceM ?? 0) * 100),
    ];
    enc.writeMessage(18, fields, 2);
  }
  return Buffer.from(enc.close());
}

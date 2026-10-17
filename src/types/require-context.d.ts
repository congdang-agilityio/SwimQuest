// webpack's require.context, used by src/lib/art/mockup-art.ts to load every art group manifest.
declare namespace NodeJS {
  interface Require {
    context(
      directory: string,
      useSubdirectories: boolean,
      regExp: RegExp,
    ): { keys(): string[]; (id: string): unknown };
  }
}

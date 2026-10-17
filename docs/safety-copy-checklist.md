# Safety copy checklist

`npm run check:safety-copy` (part of `npm run lint` and CI) scans every `messages/vi/*.json` and
`messages/en/*.json` for phrases that encourage unsafe swimming. It prints the file and key of
each match. The `safety` namespace may name the risks it warns about. Patterns live in
`src/lib/safety/unsafe-phrases.ts`; add new ones there.

Reviewers: before approving new or changed copy, check that it does not:

- [ ] Reward or praise longer distance, faster pace or "beating your limit" in a way that urges
      swimming past tiredness, cold or discomfort.
- [ ] Suggest swimming at night, at dusk or in the dark.
- [ ] Suggest swimming alone in open water (a buddy or a lifeguard is always assumed).
- [ ] Treat the voyage map as a real route to navigate.
- [ ] Appear in only one language: unsafe or not, keep vi and en equivalent.

A warning such as "never swim alone" is fine outside `safety.json`; the scanner skips phrases
preceded by a negation (never, do not, không, đừng...).

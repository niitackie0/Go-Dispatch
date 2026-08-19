# Dependencies, and the three advisories we are not fixing

`npm audit` reports three high-severity advisories that will not go away, and
this page is why. A clean audit is worth having partly so that anything new in
it gets read; an audit with three permanent entries nobody has explained is an
audit nobody reads at all.

## Fixed

- **nanoid** — 3.3.11 → 3.3.18. Custom generators could loop indefinitely at
  size zero.
- **postcss** — 8.5.6 → 8.5.26. `sourceMappingURL` could read arbitrary `.map`
  files when `from` was unset. Build-time only, never shipped.

Both were ordinary upgrades and are done.

## Accepted, with reasons

Three entries remain, and they are all one problem wearing three names:

```
prisma          high   →  @prisma/config
@prisma/config  high   →  deepmerge-ts
deepmerge-ts    high   stack exhaustion merging recursive object graphs
```

**npm's proposed fix is to downgrade `prisma` from 7.9.1 to 6.12.0.** That is
not a fix. Prisma 7 is a different major: `prisma.config.ts` exists because
Prisma 7 moved the connection URL out of the datasource block, and the app
connects through `@prisma/adapter-pg`, which is Prisma 7's driver-adapter API.
Going back to 6 means rewriting the data layer to silence a warning.

**And the advisory does not reach us.** `deepmerge-ts` is used by
`@prisma/config` to merge configuration when the Prisma CLI starts. The input
it merges is `prisma.config.ts` — a static file in this repository. Nothing a
customer or an attacker can influence goes anywhere near it, and it does not
run in the deployed server at all: `dist/server.cjs` does not include the CLI.
The exploit requires feeding it a recursive object graph, which would mean
first being able to edit our own source.

So the risk is a build-time crash that would require repository write access to
trigger — at which point the attacker has better options than crashing a build.

**Prisma 7.9.1 is the latest stable release**, so there is no forward version to
move to. The real fix comes upstream.

## What catches it when the fix lands

`.github/dependabot.yml`, weekly. Patch and minor bumps are grouped into one
pull request; a major gets its own, because a major is a decision and should not
be buried in a batch of five.

When Prisma ships a release that drops the vulnerable `deepmerge-ts`, Dependabot
opens a PR for it and this section can be deleted.

## Re-checking

```bash
npm audit --omit=dev
```

`--omit=dev` because the deployed artefact is `dist/server.cjs` plus the runtime
dependencies; a vulnerability in a build tool has a different shape and a
different urgency. Run it without the flag too before a handover, so nothing is
hiding behind the filter.

Expect **three high**, all Prisma, all the above. Anything else is new and wants
reading.

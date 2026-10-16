# Contributing to Job Tracker

Thanks for helping. Job Tracker is free and open source under the AGPL-3.0, and every contribution is shared under the same licence.

## Ground rules

- Be kind; see the [Code of Conduct](CODE_OF_CONDUCT.md).
- Only free and open-source tools. No paid APIs, no paid AI, no analytics or trackers.
- New dependencies need a short justification in the pull request (why it's needed, its licence, whether it's maintained). Prefer what's already in `package.json`.
- Security problems go through [SECURITY.md](SECURITY.md), never a public issue.

## Getting started

Follow **Develop** in the [README](README.md). Node 22 (see `.nvmrc`) and Docker are required.

## Making a change

1. Branch from `main`.
2. Keep commits small. Start each message with a type and the story ID if there is one, for example `feat(B2): drag cards between stages` or `fix(A3): expire reset links after use`.
3. Sign your commits (`git commit -S`); `main` only accepts signed commits.
4. Run the checks before you push:

   ```sh
   npm run lint && npm run typecheck && npm run test:unit && npm run test:integration
   ```

5. Before you push, the pre-push hook runs `npm run verify`: lint, type checks, unit tests and the security scans in [docs/SECURITY_PIPELINE.md](docs/SECURITY_PIPELINE.md). All must pass. Run `npm run test:integration` and `npm run test:e2e` too when you touch data access or pages.

## Rules for code

- **Data access goes through `withUser()`** in `lib/db`. Never import `PrismaClient` elsewhere (ESLint enforces it). Any new table with a `user_id` column must be added to `prisma/rls.sql`; the RLS coverage test fails otherwise.
- **Validate every input with zod** on the server, even if the form validates too.
- **Every server action checks the CSRF token** first (`csrfValid`), and every form includes `<CsrfInput />` and uses `method="post"`.
- **Never return or log secrets**, password hashes or raw tokens.
- **Accessibility:** WCAG 2.1 AA, touch targets at least 44px, works at 320px wide with no horizontal scroll, and respects reduced motion.
- **Tests:** new behaviour needs tests. Anything touching access control needs a cross-user integration test.

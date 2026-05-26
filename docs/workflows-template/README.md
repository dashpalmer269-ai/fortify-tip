# GitHub Actions templates

The CLI used to push this repo doesn't have the `workflow` OAuth scope, so it can't write files into `.github/workflows/` directly. To enable the workflow:

1. Create the directory and copy the template into place:

```bash
mkdir -p .github/workflows
cp docs/workflows-template/db-types-check.yml .github/workflows/
git add .github/workflows/db-types-check.yml
git commit -m "Enable db-types-check workflow"
git push
```

2. Add a repo secret named `SUPABASE_ACCESS_TOKEN` (Settings → Secrets and variables → Actions → New repository secret). Generate the token at <https://supabase.com/dashboard/account/tokens>.

The workflow runs on any PR that touches `supabase/migrations/**` or `lib/supabase/database.types.ts`. It regenerates the types from the live schema, diffs against the committed file, and fails the PR if they don't match — forcing the author to run `npm run db:types` and commit the result.

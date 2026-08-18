# Releasing

This project uses [changesets](https://github.com/changesets/changesets) to version and publish `astro-icon` to npm.

## v1 (stable)

Work targeting the current stable line merges into `main` as usual. Every PR that changes published behavior should include a changeset (`pnpm changeset`). Pushing to `main` triggers `.github/workflows/release.yml`, which opens a "Version Packages" PR; merging that PR publishes the new version under the `latest` npm dist-tag.

## v2 (prerelease)

v2 work happens on the `next` branch, which is in changesets [pre-release mode](https://github.com/changesets/changesets/blob/main/docs/prereleases.md) (see `.changeset/pre.json`, tag `next`). The workflow is otherwise identical: add a changeset per PR, merge into `next`. Pushes to `next` also trigger the release workflow, which versions and publishes prerelease builds (e.g. `2.0.0-next.0`) under the `next` npm dist-tag — `npm install astro-icon` still resolves to the latest v1 release; `npm install astro-icon@next` gets the v2 prerelease.

Periodically merge `main` → `next` to fold v1 fixes into v2.

## Shipping v2

When v2 is ready for a stable release:

1. On `next`, run `pnpm changeset pre exit` and commit the removal of `.changeset/pre.json`.
2. Merge `next` → `main`.
3. The resulting "Version Packages" PR versions the package as a real `2.0.0` and, once merged, publishes it under `latest`.
4. If v1 still needs a maintenance line at that point, cut a `v1` branch from `main` at the commit just before the v2 merge.

# Releasing smoque

Releases are built by GitHub Actions, staged privately on npm, approved with
maintainer 2FA, verified from the public registry, and then published as a
GitHub Release.

## One-time setup

Create the `npm-stage` and `github-release` GitHub environments. Restrict
`npm-stage` to version tags and `github-release` to `main`. Configure
`npm-stage` as the environment for the npm trusted publisher:

- owner: `zsumz`
- repository: `smoque`
- workflow: `release.yml`
- environment: `npm-stage`
- allowed action: `npm stage publish` only

In npm package settings, require two-factor authentication, disallow token
publishing, and remove obsolete automation tokens. Enable immutable GitHub
Releases when the repository setting is available.

Protect `main` with required CI, signed commits, linear history, and blocked
force pushes. Create an active `v*` tag ruleset that restricts creation,
updates, and deletion, with only the release maintainer allowed to bypass it.

## Prepare

1. Start from a clean, current `main`.
2. Update `package.json` and `package-lock.json` to the same stable version.
3. Add concise notes at `docs/releases/v<version>.md`.
4. Run `npm run release:check`.
5. Commit as `chore(release): v<version>` with the configured OpenPGP key.
6. Push `main` and wait for the complete CI matrix.

## Stage

Create and push an annotated OpenPGP-signed tag:

```sh
git tag --sign v<version> -m "smoque v<version>"
git push origin v<version>
```

The `Stage release` workflow verifies the tag, signer, package metadata,
release notes, and `main` ancestry. It reruns the release gate, packs and
smokes one tarball, and uploads that exact tarball with `npm stage publish`.
The workflow cannot publish directly.

## Approve

Review the staged package on npmjs.com or with:

```sh
npm stage view <stage-id>
npm stage download <stage-id>
```

Approve the staged tarball with maintainer 2FA:

```sh
npm stage approve <stage-id>
```

## Finalize

Run the `Finalize release` workflow with the approved stable version. It
requires `latest` to point to that version, downloads and smokes the public
registry tarball, verifies its registry signature and provenance attestation,
and creates the GitHub Release from the existing signed tag and committed
release notes.

Confirm the npm version, dist-tag, integrity, provenance, GitHub Release, and
remote tag before announcing completion.

# Releasing smoque

smoque releases through Sallyport: GitHub stages exact package bytes, a
maintainer approves them with npm 2FA, and a separate workflow verifies the
public package before creating an immutable GitHub Release.

## Prepare

1. Start from a clean, current `main`.
2. Update `package.json` and `package-lock.json` to the same stable version.
3. Add concise notes at `docs/releases/v<version>.md`.
4. Run `npm run release:check` and `npx sallyport check --remote`.
5. Commit as `chore(release): v<version>` with the configured OpenPGP key.
6. Push and require the complete CI matrix.

## Stage

Create and push an annotated OpenPGP-signed tag:

```sh
git tag --sign v<version> -m "smoque v<version>"
git push origin v<version>
```

The generated caller invokes Sallyport at one immutable commit. Package code
runs without OIDC, the tarball is sealed and smoked by artifact ID, and the
credential-bearing job runs no smoque or Sallyport checkout.

Record the stage ID and candidate run ID from the workflow summary.

## Approve

Inspect and download the staged package:

```sh
npm stage view <stage-id>
npm stage download <stage-id>
```

Compare its SHA-256 with `candidate.json`, smoke the downloaded tarball, then
approve with maintainer 2FA:

```sh
npm stage approve <stage-id>
```

## Finalize

Run the generated finalizer with the candidate run ID:

```sh
gh workflow run sallyport.yml -f candidate_run_id=<run-id>
```

The finalizer verifies npm bytes, integrity, signature, provenance, dist-tag,
tag object, signer, and release notes before publishing the immutable GitHub
Release. Rerunning it against matching public state must succeed as a no-op.

See Sallyport's [recovery guide](https://github.com/zsumz/sallyport/blob/main/docs/recovery.md)
if staging or finalization stops partway.

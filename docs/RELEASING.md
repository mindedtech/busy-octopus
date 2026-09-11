# Releasing

Publication requires explicit authorization. Release candidates do not publish anything.

## One-time setup

1. Confirm the npm account and Marketplace identity `mindedtech.busy-octopus`. Follow **First npm publication** below when ready to make the first version public.
2. Complete the Entra setup below for Marketplace. Do not store publishing tokens or client secrets in GitHub.
3. Protect the GitHub `release` environment with reviewers and tag restrictions. Require review on `main`; restrict release-tag creation to maintainers and prevent tag updates or deletion.
4. Keep `RELEASE_ENABLED=false` while the repository is private or the required protection rules are unavailable. Set it to `true` only when publication is authorized and those protections are ready.

Every publication job checks `RELEASE_ENABLED`, including retries. Setting it to `false` blocks jobs that have not started; also cancel any active Publish run to stop jobs already running.

### Entra identity setup

Set `AZURE_CLIENT_ID` and `AZURE_TENANT_ID` as variables in the `release` environment. Configure the app's federated credential for that environment, then run **Marketplace identity** from a ref allowed by its protection rules. Add the User ID from the run summary to the Marketplace publisher as **Contributor** ([Microsoft instructions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#secure-automated-publishing-to-visual-studio-marketplace)). Publish signs in through Entra using GitHub OIDC and runs `vsce publish --azure-credential`; no Azure subscription is required.

## Candidate

1. Set the stable version in `package.json` and add `## <version> - <YYYY-MM-DD>` to `CHANGELOG.md`.
2. Run `pnpm verify:release`, merge to `main`, and run **Release candidate** from that commit.
3. Download the archives, verify `SHA256SUMS`, and test both installations.

Local archives are in `artifacts/<version>/`. CI artifacts expire after seven days.

## Publish

1. Ensure the reviewed `main` commit has no `private: true`. Create and push its signed, annotated `v<version>` tag.
2. Obtain publication authorization and run **Publish** from the tag.
3. Download the final archives from the run summary, verify their checksums, and review them before approving `release`. Publish rebuilds the candidate, so review these new archives.
4. Publication proceeds in order: npm → confirm npm archive integrity → Marketplace → confirm the Marketplace version is public, validated, and downloadable with matching bytes → GitHub release. Install both public packages and test a notification.

## First npm publication

npm trusted publishing requires an existing package. Complete the first release using the same archives throughout:

1. Start **Publish** as above, but leave its npm job waiting for environment approval.
2. Download and review that run's archives and verify `SHA256SUMS`. With explicit publication authorization, sign into npm locally and run `npm publish ./busy-octopus-<version>.tgz --access public --ignore-scripts --registry=https://registry.npmjs.org` from the download directory. This immediately makes the npm package public.
3. Configure [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for `mindedtech/busy-octopus`, `publish.yml`, and the `release` environment, allowing `npm publish`.
4. Approve the original run. It verifies the existing npm archive's integrity, skips that upload, and continues to Marketplace. Do not rebuild the archives or start another run.

## Recovery

- Check the failed step and both registries first. A failed upload command can still have reached the registry. npm and Marketplace retries skip an existing version only after verifying it matches the original archive; mismatches stop recovery. If Marketplace validation or downloads are unavailable, wait for resolution before retrying.
- Use **Re-run failed jobs** on the original Publish run. Successful publisher jobs stay complete; failed jobs and their dependents resume using the original artifact ID. A visibility-check failure retries the check without repeating the preceding successful publication.
- Do not start a new Publish run or choose **Re-run all jobs** to recover a partial release: that rebuilds the archives instead of preserving the approved bytes.
- Artifacts expire after seven days. If they expire or the bytes must change, stop recovery and prepare a new version; never replace an existing version.
- Publication is not atomic. A failure leaves any earlier publication public, and the GitHub release waits for both targets to succeed.

# Paper Flock v0.12 — Zero-Cost Deployment

## Recommended host: GitHub Pages

The repository contains `.github/workflows/deploy-pages.yml`.

### Steps

1. Create a new GitHub repository.
2. Upload the contents of this project folder to the repository root.
3. Use `main` as the default branch.
4. Open **Settings → Pages**.
5. Set the source to **GitHub Actions**.
6. Open the **Actions** tab and run **Test and deploy Paper Flock**, or push a
   commit to `main`.
7. Open the URL shown by the deployment job.

The workflow:

- runs `npm test`
- copies only runtime files into `_site`
- publishes through GitHub Pages
- uses HTTPS, which is required for install and offline service workers

## Tester links

Normal game:

```text
https://YOUR-NAME.github.io/YOUR-REPOSITORY/
```

Self-guided field test:

```text
https://YOUR-NAME.github.io/YOUR-REPOSITORY/?fieldtest=1
```

Moderated tactile test:

```text
https://YOUR-NAME.github.io/YOUR-REPOSITORY/?tactiletest=1
```

Visual test:

```text
https://YOUR-NAME.github.io/YOUR-REPOSITORY/?visualtest=1
```

## Update procedure

1. Back up any creator-side imported research sessions.
2. Replace the repository files with the new build.
3. Commit and push to `main`.
4. Confirm the automated tests pass.
5. Let testers finish their current puzzle before choosing **Update ready**.
6. Re-run one offline smoke test after deployment.

## Rollback

GitHub Pages deploys from version-controlled commits. To roll back:

1. Revert the faulty commit.
2. Push the revert to `main`.
3. Wait for the Pages deployment to finish.
4. Open the app online and choose **Update ready**.

## Privacy

The deployment is static. GitHub serves the files, but Paper Flock itself has
no analytics endpoint and does not automatically upload progress, diagnostics,
or participant results.

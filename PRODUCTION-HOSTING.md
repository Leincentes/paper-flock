# Paper Flock v0.19 — Production Hosting

## Public beta

The existing GitHub Pages deployment can continue serving the controlled beta.
It supplies HTTPS and the existing GitHub Actions release process.

## Recommended production host

Use a static host that applies the included `_headers` file when moving to a
broad production release. This allows response-level:

- Content Security Policy
- clickjacking protection
- MIME-sniffing prevention
- browser-feature restrictions
- explicit service-worker cache behavior
- cross-origin opener isolation

Cloudflare Pages and Netlify understand this file format. Keep the same
production origin after launch so installed-app storage and updates remain
stable.

## Cloudflare Pages outline

1. Connect the existing GitHub repository.
2. Set the build command to `npm install && npm run verify:candidate`.
3. Set the output directory to `dist`.
4. Use Node.js 24.
5. Deploy a preview.
6. Confirm `_headers`, `release.json`, and `asset-manifest.json` are present.
7. Configure and verify the custom domain.
8. Update `app-config.json` with the final HTTPS canonical URL.
9. Run the production configuration workflow.
10. Complete one installed-app update and rollback drill on Android and iPhone.

## GitHub Pages limitation

GitHub Pages continues to use the HTML security policies in the application.
Project-controlled response headers should be verified on the final production
host.

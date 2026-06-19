# Paper Flock v1.4.2 — Production Hosting

## Current candidate host

GitHub Pages is the configured zero-cost host. It supplies HTTPS and is wired
to the qualified `dist/` artifact produced by `.github/workflows/static.yml`.

## Broader production option

A static host that applies the included `_headers` file can provide
response-level CSP, clickjacking protection, MIME-sniffing prevention,
browser-feature restrictions, and explicit service-worker cache behavior.
Cloudflare Pages and Netlify support this style of headers file.

Use this build command:

```bash
npm ci --no-audit --no-fund && npm run verify:candidate
```

Use `dist` as the output directory and Node.js 24. Keep the same production
origin after launch so installed-app storage and service-worker updates remain
stable.

Before switching hosts, verify the canonical URL, support contact, all response
headers, installed-app update behavior, backup/restore, and rollback on Android
and iPhone.

# Paper Flock v1.4.2 — Security Notes

## Runtime model

Paper Flock is a static, local-first web application. It has no application
server, account system, advertising SDK, analytics SDK, or automatic feedback
upload. The player build has no third-party runtime dependency.

## Browser policy

Every public HTML page supplies a self-only Content Security Policy,
`object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, and a
no-referrer policy. Inline styles remain allowed because board positioning and
animation variables are applied through element style properties.

## Dependency policy

Development tools install only from the public npm registry. The committed
lockfile is exact, CI runs `npm ci`, and high or critical audit findings block
the release. The locked `tmp` override is `0.2.7`.

## Verification

```bash
npm audit --audit-level=high
npm audit --omit=dev
npm run audit:hardening
npm run audit:supply-chain
```

`npm audit --omit=dev` should report no production dependency vulnerabilities.

## Hosting limitation

GitHub Pages cannot apply the repository `_headers` file as response headers.
The app therefore supplies supported HTML policies. A future host that supports
`_headers` should additionally verify CSP, Permissions Policy,
`X-Content-Type-Options`, and frame protection at the HTTP layer.

Report security concerns through the configured support contact. Remove
personal information from diagnostic or feedback exports before sharing them.

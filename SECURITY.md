# Paper Flock v0.17 — Security Notes

## Runtime model

Paper Flock is a static, local-first web application. It has no application
server, account system, advertising SDK, analytics SDK, or automatic feedback
upload.

## Browser policy

Every public HTML page supplies:

- a self-only Content Security Policy
- `object-src 'none'`
- `base-uri 'none'`
- `form-action 'self'`
- a no-referrer policy

`styles.css` still permits inline styles because the board renderer sets
position and animation variables through element style properties.

## Static audit

Run:

```bash
npm run audit:hardening
```

The audit checks public pages, CSP, referrer policy, inline scripts, focus
styles, forced colors, text scaling, reduced motion, control targets,
dangerous JavaScript execution APIs, and third-party runtime dependencies.

## Hosting limitation

GitHub Pages does not provide project-controlled response headers through this
repository. The build therefore uses supported HTML policies where possible.
A future custom host may add HTTP response headers such as
`Content-Security-Policy`, `Permissions-Policy`, and
`X-Content-Type-Options`.

## Reporting

Configure a public support contact in `app-config.json` before broad release.
Do not publish security reports or diagnostic exports without checking them for
accidental personal information.

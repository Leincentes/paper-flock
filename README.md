# Paper Flock 1.0 — Production Release

Paper Flock 1.0 is configured for production under **Gamelo Studio**.

- Publisher: Gamelo Studio
- Support: leincentes@gmail.com
- Canonical URL: https://leincentes.github.io/paper-flock/
- Repository: https://github.com/leincentes/paper-flock

## Validate

```bash
npm ci
npm test
npm run verify
npm run build
npm run audit:release
npm run validate:production
```

Push the 1.0 source to `main`, wait for every workflow job to pass, download
`paper-flock-v1.0-quality-evidence`, import it through Prototype testing tools,
and type `RELEASE PAPER FLOCK 1.0` to create the final approval record.

# Security policy

## Reporting a vulnerability

Please **don't open a public issue** for security problems. Use GitHub's private reporting
instead: *Security → Report a vulnerability* in this repository. You'll get an answer within a
few days; fixes are released as a new add-on version on addons.thunderbird.net and GitHub.

Relevant are especially: anything that lets mail content run code or load remote content in the
preview, leaks mail data or API keys to anyone other than the provider the user chose, or makes
the add-on act (delete, move, send) without the user's click.

## Supported versions

Only the latest released version gets fixes.

## How the project stays up to date

- The add-on ships **no third-party code** – everything in `src/` is written here.
- Build tools are pinned in `package-lock.json`; **Dependabot** proposes updates for them and
  for the GitHub Actions weekly (security updates immediately).
- **CI** builds every push and pull request, runs Mozilla's `addons-linter` and `npm audit`,
  and reviews new dependencies in pull requests. **CodeQL** scans the JavaScript and the
  workflows weekly and on every change.

# Security policy

## Supported versions

Before the first public release, only the current default branch receives fixes. After publication, the latest minor line will receive security fixes. Older pre-1.0 minor lines may be unsupported.

## Report a vulnerability

Do not open a public issue for a suspected vulnerability. Use the repository host's private security advisory feature. If that feature has not been configured yet, contact the maintainer privately and include:

- the affected version or commit;
- a minimal reproduction;
- the expected impact;
- whether you know of public exploitation.

Do not include real user images or secrets in a report. The maintainer will acknowledge a complete report within seven days and will coordinate disclosure after a fix is available.

## Security boundaries

The package processes caller-provided bytes inside browser WebAssembly. It validates dimensions and buffer lengths in TypeScript and Rust. These checks do not make arbitrary image decoders safe because this package does not decode compressed image formats.

Generated npm packages must come from the tagged release workflow with provenance. Review dependency changes and packed contents before publishing.

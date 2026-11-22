# Deployment and trust policy

This project is published at **https://everdrift.netlify.app/**. GitHub Pages must remain disabled for this repository while the shared `genzadelio.github.io` host is under Google Safe Browsing review.

No hosting platform can guarantee that a URL will never be reviewed or flagged. These release rules reduce avoidable trust, download, credential, and deceptive-interface risks.

## Required release checklist

- Keep the site clearly identified as a browser game and do not add unrelated account, payment, credential, or personal-data collection.
- Do not commit API keys, tokens, credentials, or other secrets.
- Keep the Netlify canonical URL and `og:url` aligned with the primary public deployment.
- Keep the restrictive `Content-Security-Policy` and security headers in `netlify.toml`.
- Confirm first-party assets, gameplay, and the installable app shell after each release.
- If GitHub Pages is ever re-enabled, repeat the content review and Safe Browsing check first.

## Deployment

Netlify uses the repository root as its publish directory and reads `netlify.toml` for security headers. There is no build step.

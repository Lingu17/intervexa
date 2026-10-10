# Troubleshooting

- **Request origin is not allowed:** use localhost or 127.0.0.1 at the configured development port; otherwise add the exact trusted origin to ALLOWED_ORIGINS and restart the API. Production requires HTTPS. Do not disable CSRF or permit wildcard origins.
- **GitHub not configured:** social GitHub OAuth and repository GitHub App credentials are separate. The repository setup screen lists missing backend variable names. Upload a valid App private key as a secret file. See [integration setup](integrations.md).
- **Social buttons disabled:** the API lacks the corresponding client ID/secret. Configure exact callbacks in the provider console and backend secrets. Password signup still accepts personal email.
- **OAuth email collision:** sign into the existing account and link the provider from Profile & data. Expired/cookie-mismatched/replayed state requires starting again. Matching email is not a recovery path.
- **Index unavailable:** load authorized branches and index one. A deleted branch, revoked installation or rate limit produces an error. Refresh is atomic and preserves the previous index on failure. Files outside the bounded subset are not browsable.
- **No code results:** try a known path or Python symbol, inspect coverage or refresh. Lexical Q&A is not semantic retrieval. Optional semantic search needs an embedding index and paid query consent.
- **Provider rejected output:** models may lack text or embedding capability despite appearing in metadata. Malformed responses and invalid source citations are rejected. No automatic model/provider switching occurs.
- **Contact failure:** a success message requires a committed row. Validation, honeypot, rate limit or database failure remains an error. The recorded submission is not an email delivery promise.
- **Verification inconclusive:** inspect baseline, dependencies, merge conflict, framework and runner configuration. Missing infrastructure cannot establish a bug. Never execute untrusted source on the API host to bypass this.
- **3D unavailable:** the equivalent SVG/module controls remain usable. Reduced motion uses the fallback intentionally.
- **Local rate limit during repeated browser testing:** tests create identified local accounts and contact records. API-observed loopback traffic shares rate buckets; restart the local API to clear process-local buckets. Do not alter production limits to hide abuse.

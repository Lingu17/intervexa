# Contact email notifications

Contact submissions commit to the database before returning success. Set these server-only Render API environment values to enable notifications:

- `RESEND_API_KEY`: a sending-only Resend key. Never use a NEXT_PUBLIC variable.
- `CONTACT_EMAIL_TO`: the operator's fixed notification address.
- `CONTACT_EMAIL_FROM`: an authorized sender, initially `Intervexa <onboarding@resend.dev>` for notifications to the Resend account email. A verified domain is required for other recipients.

The API worker claims one message at a time using an atomic database update. Each request uses `contact/<submission-id>` as its Resend idempotency key. Network errors, rate limits and transient failures receive up to five attempts with exponential delay. A 60-second lease recovers interrupted sends. Requests older than one hour stop retrying, inside Resend's 24-hour idempotency window. Permanent rejections stop immediately. Existing submissions are not emailed retroactively.

States are `disabled`, `queued`, `sending`, `accepted`, and `failed`. `accepted` means the provider accepted the request, not that the recipient received or read it. The public confirmation says queued and never claims delivery. The sender is fixed; visitor email is Reply-To, preventing arbitrary-recipient abuse. Plain text avoids rendering visitor HTML. Response bodies and credentials are not logged or stored.

Monitor failed notifications using an operator database session:

```sql
SELECT id, created_at, email_state, email_attempts, email_provider_id
FROM contact_submissions
WHERE email_state IN ('failed', 'queued', 'sending')
ORDER BY created_at DESC;
```

Use Resend's email dashboard for delivery/bounce details. The worker requires an active API process; free Render sleep delays processing. Form storage retains submissions for 90 days, independent of email success. Resend has its own retention policy. Automatic visitor acknowledgements, password recovery, and email verification are separate features and are not enabled by this integration.

Reference: [Resend email API](https://resend.com/docs/api-reference/emails/send-email), [idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

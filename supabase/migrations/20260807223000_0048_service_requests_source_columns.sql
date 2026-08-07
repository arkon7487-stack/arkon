/*
# Add source metadata to service_requests for unified Admin Support inbox

1. Purpose
- Extend the existing `service_requests` table so it can hold both:
  - Registered customer requests (source = 'customer_portal')
  - Public website visitor requests (source = 'website')
- Allow `client_id` to be NULL for unauthenticated website visitors.

2. Fields added
- `source` text, defaults to 'customer_portal' for backward compatibility
- `requester_name` text, nullable
- `requester_phone` text, nullable
- `requester_address` text, nullable
- `requested_service` text, nullable

3. Security
- No RLS policy changes.
- No existing data affected.
- Public website INSERT goes through the existing Edge Function (service_role).
*/

ALTER TABLE public.service_requests
  ALTER COLUMN client_id DROP NOT NULL;

ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'customer_portal',
  ADD COLUMN IF NOT EXISTS requester_name text,
  ADD COLUMN IF NOT EXISTS requester_phone text,
  ADD COLUMN IF NOT EXISTS requester_address text,
  ADD COLUMN IF NOT EXISTS requested_service text;

CREATE INDEX IF NOT EXISTS idx_service_requests_source_created
  ON public.service_requests (source, created_at DESC);

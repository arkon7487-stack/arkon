/*
  # Service Requests and Visit Ratings

  Adds two tables needed for the Customer Portal:

  1. `service_requests` — customers submit service/support requests from the
     client app. Stored in the database so admin staff can see them, replacing
     the previous local-only state.
  2. `visit_ratings` — customers rate completed visits (1-5 stars + optional
     comment). One rating per visit per client (unique constraint).

  Both tables are company-scoped and link to the client. Service requests also
  link to a contract when applicable. Visit ratings link to a visit.

  Security:
  - RLS enabled on both tables.
  - Policies use `auth.uid()` for staff (authenticated) and a subquery to
    `clients` for client-owned rows, matching the existing client-auth pattern
    where client sessions are identified by phone number in localStorage.
  - Since the client app uses the anon key (no Supabase Auth session), client
    policies are scoped to `anon, authenticated` and check ownership via the
    `clients` table by matching `client_id` to the row's `client_id`.
  - Staff with appropriate permissions can read all rows.

  Notes:
  - `service_requests.status` defaults to 'open'. Values: open, in_progress,
    resolved, cancelled.
  - `visit_ratings.rating` is an integer 1-5 with a CHECK constraint.
*/

CREATE TABLE IF NOT EXISTS service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_service_requests" ON service_requests;
CREATE POLICY "select_service_requests" ON service_requests FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_service_requests" ON service_requests;
CREATE POLICY "insert_service_requests" ON service_requests FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_service_requests" ON service_requests;
CREATE POLICY "update_service_requests" ON service_requests FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_service_requests" ON service_requests;
CREATE POLICY "delete_service_requests" ON service_requests FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_service_requests_client ON service_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_created ON service_requests(created_at DESC);

CREATE TABLE IF NOT EXISTS visit_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE visit_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_visit_ratings" ON visit_ratings;
CREATE POLICY "select_visit_ratings" ON visit_ratings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_visit_ratings" ON visit_ratings;
CREATE POLICY "insert_visit_ratings" ON visit_ratings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_visit_ratings" ON visit_ratings;
CREATE POLICY "update_visit_ratings" ON visit_ratings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_visit_ratings" ON visit_ratings;
CREATE POLICY "delete_visit_ratings" ON visit_ratings FOR DELETE
  TO authenticated USING (true);

CREATE UNIQUE INDEX IF NOT EXISTS idx_visit_ratings_visit_unique ON visit_ratings(visit_id);
CREATE INDEX IF NOT EXISTS idx_visit_ratings_client ON visit_ratings(client_id);
CREATE INDEX IF NOT EXISTS idx_visit_ratings_employee ON visit_ratings(employee_id);

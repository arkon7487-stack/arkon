# ARKON Mobile Backend Contract

This document describes the stable backend contract that the future React Native / Expo mobile app must use. It reflects the current state of the web application on the `backend-security-remediation` branch.

---

## SHARED

- **Supabase project**: Single project, shared by web and mobile.
- **Service modules to reuse/adapt**: `src/services/*` (visitService, clientService, contractService, invoiceService, paymentService, notificationService, etc.) are framework-agnostic data-access layers. They use `@supabase/supabase-js` directly and return typed objects. On mobile, swap the supabase client initialization but keep the same service interfaces.
- **Session storage**: `src/lib/sessionStorage.ts` exports a `SessionStorageAdapter` interface. Web uses `localStorage`. Mobile must replace this with Expo SecureStore via `setSessionStorageAdapter()`.
- **Focus refresh**: `src/lib/useFocusRefresh.ts` uses `document.visibilitychange` / `window.focus`. On mobile, replace with `AppState` change events.
- **Fields that must never be stored client-side**:
  - Worker passwords (use Supabase Auth only)
  - Client PINs (validated server-side via edge function)
  - Client tokens (stored in secure storage only, never in plain AsyncStorage)
  - Any financial balance calculations (always derived from server data)

---

## WORKER

### Authentication
- **Method**: Supabase Auth email/password (`supabase.auth.signInWithPassword`)
- **Identity resolution**: `auth.uid()` → `profiles.user_id` → `profiles.employee_id` → `employees.id`
- **RLS function**: `current_user_employee_id()` returns the employee_id for the current auth user
- **Session inactivity rule**: 48 hours. If `lastActivityAt` in storage is older than 48h, sign out from Supabase Auth and clear local session state.
- **Activity tracking**: Update `lastActivityAt` on meaningful user interaction (clicks, key presses). Throttle to once per 60 seconds. Do not write on every frame.
- **Logout behavior**: `supabase.auth.signOut()` + clear `lastActivityAt` + clear cached profile/session. Return to login screen. Next worker must authenticate fresh.
- **Expired Supabase JWT**: Do not keep the worker logged in. Let `onAuthStateChange` handle it.

### Visits Service
- **Query**: `visitService.getByEmployee(employeeId)` — selects from `visits` where `employee_id = current_user_employee_id()`
- **RLS policy**: `select_visits` — `is_current_user_admin() OR (employee_id = current_user_employee_id())`
- **Visit status source of truth**: The `visits` table in the database. Never use frontend-only state for visit status. Always refetch on app open.
- **Visit statuses**: `scheduled` → `started` → `completed` (via QR scan). Also: `cancelled`, `archived`.
- **Visit detail fields**: customer name, address, phone (where allowed), date, start time, end time, expected duration, status, package/service name, visit instructions, notes, QR action, navigation link.

### QR Service
- **Workflow**: Scheduled → Started (first scan) → Completed (second scan). Unchanged. Do not redesign.
- **Payload**: QR codes contain a `code_value` that maps to a client. Do not change payload format.
- **Validation**: `qrService.validate(codeValue)` returns `{ valid, clientId }`.

### Notification / Realtime Strategy
- **Realtime**: `useVisitRealtime()` subscribes to Supabase Realtime `postgres_changes` on the `visits` table. On any change, refetch visits.
- **Fallback**: `useFocusRefresh()` refetches when the app/tab regains focus. This is the primary fallback for mobile when Realtime disconnects.
- **Cleanup**: Always unsubscribe on unmount/logout to avoid duplicate subscriptions.

---

## CUSTOMER

### Authentication
- **Method**: Phone number + 4-digit PIN (custom, not Supabase Auth)
- **Edge function**: `arkon-client-auth` — handles `login`, `activate`, `validate_session`, `logout`, `change_pin`, `check_status` actions
- **Token**: Returned as `token` in the response. Stored in secure storage. Sent as `x-client-token` header on all Supabase requests.
- **Identity resolution**: `get_client_id_from_token()` reads the PostgREST `request.headers ->> 'x-client-token'` header → looks up `client_sessions` → returns `client_id`
- **Session expiry**: Client sessions have `expires_at` and `revoked` fields. Expired/revoked tokens return NULL from `get_client_id_from_token()`.

### Visits Retrieval
- **Query**: `visitService.getByClient(clientId)` — selects from `visits` where `contract.client_id = get_client_id_from_token()`
- **RLS policy**: `anon_select_own_visits` — uses `get_client_id_from_token()` to ensure customer only sees their own visits
- **Categorization**:
  - Upcoming: `status = 'scheduled'` and `scheduled_date >= today`
  - Current/Started: `status = 'started'`
  - Completed: `status = 'completed'`
  - History: all past visits
- **Timezone**: Use consistent timezone handling. Compare dates as date strings (YYYY-MM-DD) to avoid timezone drift.

### Contracts / Packages
- **Query**: `supabase.from('contracts').select('*, package:packages(*)').eq('client_id', clientId)`
- **RLS**: Client can only read their own contracts via `get_client_id_from_token()` policy

### Invoices / Payments / Receivables
- **Source of truth**: Contracts use `contracts.final_amount`, `amount_paid`, `remaining_balance`, and `payment_status`; additional/emergency obligations use `invoices.total`, `amount_paid`, `remaining_balance`, and `payment_status`, with detail in `payments`.
- **No duplicate customer balance tables**: The Customer Portal derives all financial data from the same tables used by Finance/Receivables.
- **Display fields**:
  - Original contract total: `contract.final_amount`
  - Original contract paid/remaining/status: `contract.amount_paid`, `contract.remaining_balance`, `contract.payment_status`
  - Additional/emergency invoice total/paid/remaining/status: `invoice.total`, `invoice.amount_paid`, `invoice.remaining_balance`, `invoice.payment_status`
  - Receivables: contract remaining balances plus remaining balances on separately billable visit invoices
- **Synchronization**: Contract payments update contract-level fields. Additional/emergency payments update only the linked invoice through `record_visit_invoice_payment`. Customer Portal reads these same records directly — no separate balance tables.

### Service Requests
- **Query**: `serviceRequestService.listByClient(clientId)`
- **Create**: `serviceRequestService.create({ client_id, subject, description })

### Ratings
- **Query**: `ratingService.getByVisit(visitId)`
- **Create**: `ratingService.create({ visitId, clientId, employeeId, rating, comment })

### Additional/Emergency Visits
- **Service**: `additionalVisitService` — handles creation, worker availability, and financial charges for additional/emergency visits
- **Visit types**: `normal` (recurring), `additional` (زيارة إضافية), `emergency` (زيارة طارئة)
- **One-time**: Additional/emergency visits are one-time only. No recurrence.
- **Scheduling**: Uses the existing `schedulingEngine.suggestEmployees()` for conflict detection. Any overlap (even 1 minute) = unavailable.
- **Worker assignment**: Admin selects from available workers. Workers cannot self-assign.
- **Financial charge**: Each chargeable additional/emergency visit creates a separate invoice linked to the visit via `invoices.visit_id`. The original package/contract value is NEVER modified.
- **Invoice charge_type**: `additional_visit` or `emergency_visit`
- **Payment**: `record_visit_invoice_payment` RPC updates only the invoice's `amount_paid`, `remaining_balance`, `payment_status`. Does NOT touch contract-level fields.
- **Receivables**: Additional visit invoices with `remaining_balance > 0` appear in Finance receivables alongside contract receivables.
- **Total receivables**: `contract.remaining_balance + SUM(invoice.remaining_balance WHERE charge_type != 'contract')`
- **QR**: Additional visits use the same QR workflow (Scheduled → Started → Completed). No QR redesign.
- **Worker Portal**: Shows visit type badge (زيارة إضافية / زيارة طارئة) on visit cards.
- **Customer Portal**: Shows additional visit charges with charge amount, paid, remaining, and payment status.
- **Permissions**: Only admin/management roles can create additional visits. Workers and customers cannot self-create.

---

## REALTIME SECURITY NOTE

Customer portal Realtime channels cannot be securely filtered by client token in the current architecture (Realtime uses Supabase Auth, not custom tokens). The web app uses **safe refetch on focus** instead of Realtime for customer portal. The mobile app should do the same until a token-based Realtime auth solution is implemented.

Worker portal uses Supabase Auth, so Realtime works with RLS filtering. This is safe for mobile.

---

## WEB-ONLY ADAPTERS THAT MOBILE MUST REPLACE

| Module | Web | Mobile |
|---|---|---|
| `src/lib/sessionStorage.ts` | `localStorage` | Expo SecureStore |
| `src/lib/useFocusRefresh.ts` | `document.visibilitychange` | `AppState` |
| `src/lib/qr/webCamera.ts` | `getUserMedia` + `<video>` | `expo-camera` |
| `src/lib/qr/scanner.ts` | `jsqr` library | `expo-barcode-scanner` |
| `src/components/QrScannerView.tsx` | `<video>` + canvas | `expo-camera` component |

The QR workflow layer (`src/lib/qr/workflow.ts`) and realtime sync layer (`src/lib/qr/realtime.ts`) are platform-agnostic and can be reused as-is.

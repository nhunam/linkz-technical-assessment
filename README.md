# Seat Reservation Platform

A public seat reservation system built with TypeScript, demonstrating engineering judgment in authentication, concurrency control, payment handling, and operational reliability.

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Runtime** | Bun | Fast startup, native TypeScript, built-in test runner |
| **Backend** | Hono | Lightweight, type-safe, Web Standards API (portable across runtimes) |
| **Frontend** | React 19 + Rsbuild | Modern bundler (Rspack-based), fast HMR, proxy support |
| **Database** | PostgreSQL 17 | ACID transactions, battle-tested for concurrent writes |
| **ORM** | Drizzle | Type-safe queries, lightweight, SQL-first philosophy |
| **Auth** | Clerk | Delegated identity provider, JWT tokens, zero password storage |
| **Payments** | Stripe | PaymentIntents API, webhook-based confirmation, idempotent |
| **Styling** | Tailwind CSS | Utility-first, rapid prototyping, no runtime overhead |
| **Monorepo** | pnpm workspaces | Shared validators between FE/BE, disk-efficient |

## Architecture

```
seat-reservation/
├── apps/
│   ├── be/          # Hono API server (port 8081)
│   └── fe/          # React SPA (port 3031, proxies /api → BE)
├── packages/
│   └── shared/      # Zod validators + TypeScript types
└── docker-compose.yml  # PostgreSQL 17
```

## Architectural Decisions

### 1. Why Clerk instead of self-managed auth?

> *"Why do I want to store passwords and put the security burden on myself? As a scaling business, I want to spend money and effort on business features."*

**Decision**: Delegate authentication entirely to Clerk instead of managing passwords with better-auth.

**What changed**:
- Removed `better-auth` (session cookies, password hashing, DB-stored sessions)
- Added `@clerk/backend` + `@clerk/react` for JWT-based auth
- Backend validates JWT from `Authorization: Bearer <token>` header
- Frontend uses Clerk's pre-built `<SignIn />` / `<SignUp />` components (Google OAuth included)

**Benefits**:
- Zero password storage — no bcrypt, no leaked credential risk
- Security updates (MFA, brute-force protection, bot detection) handled by Clerk
- Engineering effort goes to business logic, not auth maintenance
- Compliance (SOC 2, GDPR) delegated to the identity provider

**Trade-off**: Vendor dependency on Clerk. Mitigated by keeping auth behind a thin middleware — swapping providers only requires changing the JWT verification layer.

### 2. JWT tokens for mobile-ready auth

> *"Does the session approach handle mobile apps in the future?"*

**Decision**: Replace session cookies with JWT Bearer tokens.

**What changed**:
- Old: `credentials: "include"` with HttpOnly session cookies
- New: `Authorization: Bearer <token>` header on every request
- Backend middleware uses `verifyToken()` from `@clerk/backend`

**Why this matters**:
- Session cookies are browser-only — mobile apps (React Native, Flutter) can't use them
- JWT tokens work identically across web, mobile, and API clients
- Stateless verification — no DB lookup per request, just signature check
- Clerk issues short-lived tokens with automatic refresh

**Trade-off**: JWTs can't be instantly revoked (valid until expiry). Clerk mitigates this with short-lived tokens (~60s) and background refresh, so revocation propagates within a minute.

### 3. Handling 100 concurrent users booking 3 seats

> *"What if there are 100 users trying to book the 3 seats concurrently?"*

**Decision**: Optimistic concurrency control with atomic WHERE-clause guards.

**How it works**:
```sql
-- Only one of 100 concurrent requests succeeds
UPDATE seats SET status = 'held', held_by = :userId
WHERE id = :seatId AND status = 'available'
```

If two users try to hold the same seat simultaneously, PostgreSQL guarantees only one `UPDATE` matches the `WHERE` condition. The loser gets a `409 Conflict` response.

**The full seat lifecycle**:
```
available → held (10-min TTL) → reserved (after payment)
    ↑           ↓
    └── expired/released
```

**Why not `SELECT ... FOR UPDATE`?**
- Pessimistic locking holds row locks during the entire transaction
- With 100 users, this creates lock contention and queuing
- Optimistic approach: try the update, handle failure — no waiting

**Seat states from the user's perspective** (simplified to 3 states):
| State | Color | Meaning |
|-------|-------|---------|
| Available | Green | Can be selected |
| Yours | Blue | Held or reserved by you |
| Unavailable | Gray | Held or reserved by another user |

**Expired hold cleanup**: Lazy cleanup on every seat query. Expired holds are automatically released when any user loads the seats page. For production, a background cron job would provide more precise timing.

### 4. Stripe webhook handling and failure recovery

> *"How would you handle a failed webhook from payment gateway?"*

**Decision**: Webhook-first with polling fallback. Never lose a payment.

**The payment flow**:
```
Frontend                    Backend                     Stripe
   │                           │                          │
   ├─ createPayment ──────────►├─ PaymentIntent.create ──►│
   │◄── clientSecret ──────────┤◄── pi_xxx ────────────────┤
   │                           │                          │
   ├─ stripe.confirmPayment ──►│                          │
   │   (Stripe.js → Stripe)    │                          │
   │                           │◄── webhook: succeeded ────┤
   │                           ├─ complete reservation     │
   │                           │                          │
   ├─ poll getPaymentStatus ──►│                          │
   │◄── { status: completed } ─┤                          │
```

**Webhook reliability layers**:

1. **Signature verification**: Every webhook is verified with `stripe.webhooks.constructEvent()` using the webhook signing secret. Invalid signatures get `401`.

2. **Idempotent processing**: The `webhook_events` table deduplicates by Stripe event ID. If Stripe retries the same event (which it does on failure), we skip reprocessing:
   ```
   webhook_events
   ├── event_id (unique) — Stripe's event ID
   ├── status: received → processing → processed | failed
   ├── retry_count
   └── error_message
   ```

3. **Transaction-wrapped**: The entire webhook handler runs in a database transaction. If any step fails, everything rolls back — no partial state.

4. **Polling fallback**: If the webhook is delayed or lost, the frontend polls `GET /payments/:id/status`. The backend checks Stripe directly:
   ```typescript
   // If payment is pending but Stripe shows succeeded → complete it
   if (payment.status === "pending") {
     const pi = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
     if (pi.status === "succeeded") await completePayment(payment);
   }
   ```

5. **Race condition safety**: Payment completion uses a transaction with fresh reads:
   - Re-check payment is still pending (another process might have completed it)
   - Re-check seat is still held by this user (hold might have expired)
   - If seat was lost after payment: mark payment as `refunded`

**Payment state machine**:
```
pending → completed (webhook or polling confirms Stripe succeeded)
pending → failed    (Stripe reports payment_intent.payment_failed)
pending → expired   (10-minute TTL exceeded)
pending → refunded  (payment succeeded but seat was lost)
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- [pnpm](https://pnpm.io/) (v8+)
- [Docker](https://www.docker.com/) (for PostgreSQL)
- [Clerk](https://clerk.com/) account (free dev tier)
- [Stripe](https://stripe.com/) account (test mode)

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Start PostgreSQL
docker compose up -d

# 3. Configure environment
cp .env.example .env
# Fill in: CLERK_SECRET_KEY, PUBLIC_CLERK_PUBLISHABLE_KEY,
#          STRIPE_SECRET_KEY, PUBLIC_STRIPE_PUBLISHABLE_KEY,
#          STRIPE_WEBHOOK_SECRET

# 4. Run database migrations
cd apps/be && bun run db:migrate

# 5. Seed initial data (3 seats)
bun run db:seed

# 6. Start development servers
cd ../.. && make dev
```

### Stripe Webhook (Local Development)

```bash
# Install Stripe CLI, then:
stripe listen --forward-to localhost:8081/api/webhooks/stripe

# Copy the webhook signing secret (whsec_...) to .env
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | Clerk secret key (from Clerk dashboard) |
| `PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `STRIPE_SECRET_KEY` | Stripe secret key (test mode) |
| `PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `FRONTEND_URL` | Frontend URL for CORS (`http://localhost:3031`) |
| `PORT` | Backend server port (`8081`) |

### Usage

1. Open `http://localhost:3031`
2. Sign in with Google (or sign up via Clerk)
3. Select an available seat
4. Enter test card `4242 4242 4242 4242` (exp: `12/34`, CVC: `123`)
5. Payment confirmed → seat reserved

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | No | Health check |
| `GET` | `/api/seats` | No | List all seats with current status |
| `POST` | `/api/seats/:id/hold` | Yes | Hold a seat (10-min TTL) |
| `POST` | `/api/seats/:id/release` | Yes | Release a held seat |
| `POST` | `/api/payments` | Yes | Create Stripe PaymentIntent for held seat |
| `GET` | `/api/payments/:id/status` | Yes | Poll payment status + reservation |
| `POST` | `/api/webhooks/stripe` | No | Stripe webhook endpoint (signature-verified) |

## Database Schema

```
┌──────────┐     ┌──────────┐     ┌──────────────┐     ┌────────────────┐
│   user   │     │  seats   │     │   payments   │     │ webhook_events │
│──────────│     │──────────│     │──────────────│     │────────────────│
│ id (PK)  │◄────│ held_by  │     │ id (PK)      │     │ id (PK)        │
│ name     │     │ reserved │     │ seat_id (FK) │──►  │ event_id (UQ)  │
│ email    │     │  _by     │     │ user_id      │     │ provider       │
│          │     │ status   │     │ amount       │     │ event_type     │
│          │     │ price    │     │ status       │     │ status         │
│          │     │ label    │     │ stripe_pi_id │     │ payload        │
│          │     │          │     │ idempotency  │     │ retry_count    │
│          │     │          │     │  _key        │     │                │
└──────────┘     └──────────┘     │ expires_at   │     └────────────────┘
                                  └──────────────┘
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │ reservations │
                                  │──────────────│
                                  │ id (PK)      │
                                  │ seat_id (FK) │──► seats
                                  │ user_id      │
                                  │ payment_id   │──► payments
                                  └──────────────┘
```

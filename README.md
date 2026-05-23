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
| **Auth** | better-auth | Session-based auth with 90-day expiry, built-in Drizzle adapter |
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

### Key Design Decisions

**1. Seat Hold Pattern (Optimistic Locking)**

Instead of immediately reserving a seat on selection, the system implements a two-phase approach:
- **Hold phase**: User selects a seat → seat is marked as `held` with a 10-minute TTL
- **Payment phase**: User confirms payment → seat transitions from `held` to `reserved`

This prevents seats from being permanently locked by users who abandon the flow. Expired holds are automatically released on every seat query (lazy cleanup).

**Trade-off**: Lazy cleanup means a seat could appear "held" for a few seconds past its TTL until the next query triggers cleanup. In a production system, I'd add a background job for time-critical cleanup, but for this scope the lazy approach is pragmatically sufficient.

**2. Optimistic Concurrency Control**

The hold and payment operations use WHERE-clause guards instead of database-level locks:

```sql
UPDATE seats SET status = 'held'
WHERE id = :id AND status = 'available'
```

If two users try to hold the same seat simultaneously, only one succeeds — the other gets a conflict response. This avoids pessimistic locking overhead while still preventing double-booking.

**Trade-off**: Under extreme concurrency (thousands of simultaneous requests), `SELECT ... FOR UPDATE` would be more correct. For a 3-seat system with typical traffic, optimistic locking is simpler and sufficient.

**3. Payment as a State Machine**

Payments follow a strict state machine: `pending → completed | failed | expired`

- Payments have a 10-minute expiry window
- If payment confirmation arrives after expiry, the payment is marked `expired` and the seat is released
- If seat reservation fails after payment succeeds, the payment is rolled back to `failed`

**Trade-off**: In production, I'd use a proper payment provider (Stripe) with webhooks for async confirmation rather than synchronous mock payments. The mock approach is sufficient for demonstrating the state machine logic.

**4. Session-Based Auth with 90-Day Expiry**

better-auth provides session cookies with:
- 90-day absolute expiry (per requirement)
- 24-hour rolling refresh (reduces DB lookups)
- 5-minute cookie cache (performance optimization)
- HttpOnly cookies (XSS protection)

**Trade-off**: Session-based auth requires DB lookups on every request. The cookie cache mitigates this for active users. For a high-traffic system, I'd consider JWT with short-lived tokens + refresh tokens, but sessions are simpler to revoke and more secure by default.

**5. Shared Validators (Single Source of Truth)**

Zod schemas in `packages/shared` are used by both frontend forms and backend API validation. This eliminates schema drift between client and server.

**6. Frontend Polling (Not WebSockets)**

The seats page polls every 5 seconds to show real-time availability. 

**Trade-off**: WebSockets would give instant updates, but for 3 seats with modest traffic, polling is simpler to deploy (no sticky sessions, no WebSocket infrastructure), debug, and reason about. The 5-second interval is a balance between freshness and server load.

## Operational Considerations

### What I'd Add for Production

1. **Rate limiting** on auth endpoints (prevent brute-force)
2. **Request idempotency keys** on payment confirmation (prevent double-charges)
3. **Structured logging** (JSON logs with correlation IDs for request tracing)
4. **Health check endpoint** (`/api/health` already exists)
5. **Database connection pooling** (PgBouncer or built-in pool)
6. **Background job** for expired hold cleanup (instead of lazy cleanup)
7. **CSRF protection** on state-mutating endpoints
8. **Input sanitization** beyond Zod validation
9. **Monitoring/alerting** (Sentry, Grafana)
10. **Blue-green deployment** with zero-downtime migrations

### Security Considerations

- Passwords hashed with bcrypt (via better-auth)
- HttpOnly session cookies (no JS access)
- CORS restricted to frontend origin
- SQL injection prevented by parameterized queries (Drizzle ORM)
- User can only hold/pay for seats they themselves hold (ownership check)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- [pnpm](https://pnpm.io/) (v8+)
- [Docker](https://www.docker.com/) (for PostgreSQL)

### Setup

```bash
# 1. Clone and install dependencies
pnpm install

# 2. Start PostgreSQL
docker compose up -d

# 3. Copy environment file
cp .env.example apps/be/.env
# Edit apps/be/.env if needed (defaults work for local development)

# 4. Run database migrations
cd apps/be && bun run db:migrate

# 5. Seed initial data (3 seats)
bun run db:seed

# 6. Start development servers
cd ../.. && make dev
# Or separately:
# make dev-be  (backend on port 8081)
# make dev-fe  (frontend on port 3031)
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5438/seat_reservation` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | (see .env.example) | Session signing secret (change in production!) |
| `BETTER_AUTH_URL` | `http://localhost:8081` | Backend URL for auth |
| `FRONTEND_URL` | `http://localhost:3031` | Frontend URL (CORS origin) |
| `PORT` | `8081` | Backend server port |

### Test Account

After running `bun run db:seed`, you can sign up with any email or use the seeded test account:

| Field | Value |
|-------|-------|
| Email | `test@example.com` |
| Password | `password123` |

> To create this account, run after seeding:
> ```bash
> curl -X POST http://localhost:8081/api/auth/sign-up/email \
>   -H "Content-Type: application/json" \
>   -d '{"name":"Test User","email":"test@example.com","password":"password123"}'
> ```
> Or simply sign up through the UI at `http://localhost:3031/signup`.

### Usage

1. Open `http://localhost:3031`
2. Sign up for a new account or use the test account above
3. Select an available seat
4. Proceed to payment
5. Confirm mock payment
6. Seat is reserved!

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | No | Health check |
| `POST` | `/api/auth/sign-up/email` | No | Register new user |
| `POST` | `/api/auth/sign-in/email` | No | Login |
| `GET` | `/api/seats` | No | List all seats with current status |
| `POST` | `/api/seats/:id/hold` | Yes | Hold a seat (10-min TTL) |
| `POST` | `/api/seats/:id/release` | Yes | Release a held seat |
| `POST` | `/api/payments` | Yes | Create payment for held seat |
| `POST` | `/api/payments/:id/confirm` | Yes | Confirm payment → reserve seat |

## Database Schema

```
┌──────────┐     ┌──────────┐     ┌──────────────┐
│   user   │     │  seats   │     │   payments   │
│──────────│     │──────────│     │──────────────│
│ id (PK)  │◄────│ held_by  │     │ id (PK)      │
│ name     │     │ reserved │     │ seat_id (FK) │──► seats
│ email    │     │  _by     │     │ user_id      │
│ password │     │ status   │     │ amount       │
│ ...      │     │ price    │     │ status       │
└──────────┘     │ label    │     │ expires_at   │
                 └──────────┘     └──────────────┘
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

## Time Spent

Approximately 2 hours of focused implementation covering:
- Monorepo setup and tooling configuration
- Database schema design with concurrency handling
- Authentication integration with 90-day sessions
- Full reservation flow (hold → pay → reserve)
- Frontend with real-time seat status updates
- Documentation and trade-off analysis

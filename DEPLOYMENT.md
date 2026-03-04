# Deployment Guide — psych

Production deployment on **Vercel** with **Neon Postgres**.

---

## Prerequisites

- A [Vercel](https://vercel.com) account
- A [Neon](https://neon.tech) account (or use Vercel's Neon integration)
- A [Helius](https://helius.dev) API key (free tier works)
- An [OpenAI](https://platform.openai.com) API key (for AI chat features)
- Optional: [Birdeye](https://birdeye.so) API key (for token pricing)

---

## Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USER/psych.git
git push -u origin main
```

---

## Step 2: Create Neon Database

### Option A: Vercel Neon Integration (recommended)

1. Go to your Vercel project → **Storage** tab
2. Click **Connect Store** → **Neon Postgres**
3. Follow the prompts to create a new Neon project
4. Vercel automatically sets `DATABASE_URL` in your project env vars

### Option B: Manual Neon Setup

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project (region: closest to your Vercel deployment)
3. Copy the connection string from the dashboard
4. Add it as `DATABASE_URL` in Vercel env vars

---

## Step 3: Import Project in Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Framework: **Next.js** (auto-detected)
4. Root directory: `.` (default)
5. Build command: `npm run build` (default)
6. Output directory: `.next` (default)

---

## Step 4: Configure Environment Variables

In Vercel project → **Settings** → **Environment Variables**, add:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Neon connection string (auto-set if using Vercel integration) |
| `HELIUS_API_KEY` | Yes | Helius API key for Solana on-chain data |
| `OPENAI_API_KEY` | Yes | OpenAI API key for AI chat features |
| `OPENAI_BASE_URL` | No | Default: `https://api.openai.com/v1` |
| `OPENAI_MODEL` | No | Default: `gpt-4o` |
| `BIRDEYE_API_KEY` | No | Birdeye API key for token pricing |
| `MOCK_MODE` | No | Set to `true` to use sample data (for testing) |
| `RATE_LIMIT_WINDOW_MS` | No | Default: `60000` (1 minute) |
| `RATE_LIMIT_MAX_REQUESTS` | No | Default: `30` |

**Important**: Do NOT set `MOCK_MODE=true` in production.

---

## Step 5: Run Database Migrations

### First-time setup (push schema to Neon)

```bash
# Install dependencies locally
npm install

# Copy env file and set your DATABASE_URL
cp .env.example .env.local
# Edit .env.local with your Neon DATABASE_URL

# Push schema to database
npm run db:push
```

This creates all required tables in your Neon database.

### Alternative: Generate and run migrations

```bash
# Generate SQL migration files
npm run db:generate

# Apply migrations
npm run db:migrate
```

### On subsequent deploys

If you change the schema:
1. Run `npm run db:generate` locally to create migration files
2. Commit the migration files in `/drizzle/`
3. Run `npm run db:push` to apply changes to production

> **Note**: We recommend running `db:push` manually rather than in the Vercel build command to avoid accidental schema changes during deploys.

---

## Step 6: Deploy

Push to `main` branch. Vercel deploys automatically.

```bash
git add .
git commit -m "Production deploy"
git push origin main
```

---

## Local Development

```bash
# Clone the repo
git clone https://github.com/YOUR_USER/psych.git
cd psych

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local:
# - Set DATABASE_URL to your Neon connection string
# - Set HELIUS_API_KEY
# - Set OPENAI_API_KEY
# - Or set MOCK_MODE=true to skip external APIs

# Push DB schema (first time only)
npm run db:push

# Start dev server
npm run dev
```

The app runs at `http://localhost:3000`.

### Mock Mode

Set `MOCK_MODE=true` in `.env.local` to run without any API keys. The app will:
- Generate realistic mock Solana swap data
- Simulate AI chat responses
- Work without a database (settings save to localStorage only)

---

## Architecture

```
Browser → Next.js App Router → API Routes → Neon Postgres
                                          → Helius (Solana swaps)
                                          → Birdeye (token prices)
                                          → OpenAI (AI chat)
```

### API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/wallet/resolve` | Resolve .sol or validate address |
| POST | `/api/wallet/sync` | Fetch + compute + cache wallet data |
| GET | `/api/wallet/:address/summary` | Trading stats for a time range |
| GET | `/api/wallet/:address/pnl` | Daily PnL series for charts |
| GET | `/api/wallet/:address/swaps` | Paginated swap history |
| GET/PUT | `/api/wallet/:address/settings` | Per-wallet preferences |
| POST | `/api/chat/coach` | Streaming coaching chat (SSE) |
| POST | `/api/chat/market` | Streaming market chat (SSE) |

### Database Tables

- `wallets` — Indexed by Solana address
- `wallet_settings` — Per-wallet preferences
- `wallet_sync_runs` — Sync audit log
- `wallet_swaps` — Cached decoded swaps (max ~2000 per wallet)
- `wallet_daily_pnl` — Aggregated daily PnL series
- `chat_threads` — Coach/market chat threads per wallet
- `chat_messages` — Stored chat history

---

## Troubleshooting

### "DATABASE_URL is not set"
- Ensure Neon is connected in Vercel Storage tab
- Or manually add `DATABASE_URL` in Vercel env vars

### "Helius API error"
- Verify `HELIUS_API_KEY` is set and valid
- Check Helius dashboard for rate limits
- Set `MOCK_MODE=true` to test without Helius

### Build fails with native module error
- Ensure `better-sqlite3` is NOT in package.json (we use Neon serverless)
- Run `npm install` to update dependencies

### Schema changes not applied
- Run `npm run db:push` locally with your production `DATABASE_URL`
- Or generate + run migrations: `npm run db:generate && npm run db:migrate`

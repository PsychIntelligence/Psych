<p align="center">
  <img src="https://img.shields.io/badge/Solana-9945FF?style=flat-square&logo=solana&logoColor=white" />
  <img src="https://img.shields.io/badge/Next.js_15-000?style=flat-square&logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vercel-000?style=flat-square&logo=vercel&logoColor=white" />
</p>

<h1 align="center">psych</h1>

<p align="center">
  Understanding market psychology starts from your own trades.
</p>

<p align="center">
  <a href="https://psych.sh">psych.sh</a>
</p>

---

## About

psych is an on-chain behavioral analytics platform for Solana traders. It reads public swap history from any wallet, runs pattern detection across trade sequences, computes realized P&L, and surfaces the psychological habits that most traders never notice in themselves.

It is not a portfolio tracker. It is not a trading terminal. It does not tell you what to buy. It tells you how you behave, and where that behavior costs you money.

---

## Features

**Dashboard** — P&L across six time windows (1D through 1Y) with equity curves, win rate, profit factor, expectancy, drawdown, and hold time. All derived from on-chain swap data using FIFO cost basis.

**Behavioral Signals** — 16+ patterns detected from trade timing, sizing, and sequencing. Revenge trading, tilt streaks, overtrading, loss clustering, time-of-day bias, position sizing drift.

**AI Coach** — Streaming chat with full server-side context injection. The model receives your PnL summary, recent trades, behavioral signals, DEX breakdown, and active rules. It coaches on discipline, not on markets.

**Market Mood** — Fear/greed index, volatility classification, and regime detection derived from SOL price action. Context for understanding what environment your trades happened in.

**DEX Coverage** — Full swap parsing and source attribution:

| Protocol | Variants |
|----------|----------|
| Jupiter | v4, v6 aggregator |
| Raydium | AMM, CLMM, CPMM |
| Orca | Whirlpool |
| Meteora | DLMM, Pools |
| Pump.fun | Bonding curve |

**Settings** — Theme switching (dark / light / system), trade export to CSV and JSON, configurable guardrails, one-click data deletion.

---

## Architecture

```
Wallet ──> Helius Enhanced TX API
               |
               v
     Swap Parser (dual strategy)
         |              |
    events.swap    token/native
      parsing      transfer fallback
         |              |
         +------+-------+
                |
                v
       DEX Attribution Engine
                |
                v
       Jupiter Price API v3
          (USD pricing)
                |
       +--------+--------+
       |        |        |
       v        v        v
   FIFO P&L  Behavior  AI Coach
    Engine   Analysis   Context
       |        |        |
       +--------+--------+
                |
                v
           Client Store
```

The swap parser uses two strategies. Structured `events.swap` data from Helius is preferred. When that field is absent (common with Pump.fun and some Raydium pools), the parser reconstructs swaps from `tokenTransfers` and `nativeTransfers` on the transaction. DEX attribution checks Helius source labels first, then falls back to program ID matching with Jupiter aggregator precedence.

Pricing uses Jupiter Price API v3 with a per-key rate limit. SOL-paired trades are priced explicitly using the fetched SOL/USD rate. Birdeye is an optional secondary source for historical coverage.

---

## Data Providers

| Provider | Role | Required |
|----------|------|----------|
| [Helius](https://helius.dev) | Transaction history | Yes |
| [Jupiter](https://station.jup.ag) | Token pricing | Yes |
| [Birdeye](https://birdeye.so) | Historical prices | No |

---

## Stack

Next.js 15 (App Router), TypeScript, Tailwind CSS, Framer Motion, TradingView Lightweight Charts, Zustand, Drizzle ORM, Neon Postgres, Zod. Deployed on Vercel with serverless and edge functions.

---

## Privacy

Public on-chain data only. No private keys. No wallet signatures. No exchange API connections. All data can be exported or deleted at any time.

---

## Disclaimer

psych is not financial advice. It is a behavioral analysis tool. It does not recommend trades, tokens, or positions.

---

<p align="center">
  <a href="https://psych.sh">psych.sh</a>
</p>

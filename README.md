# Tempo App

The Tempo web app.

## Setup

```bash
pnpm install
```

## Development

```bash
pnpm dev          # defaults to presto
pnpm dev:presto   # mainnet
pnpm dev:moderato # testnet
pnpm dev:devnet   # devnet
```

## Scripts

```bash
pnpm check        # biome + types
pnpm check:types  # typescript only
pnpm build        # production build
pnpm deploy       # deploy to cloudflare (requires auth)
```

## Bundle Analysis

```bash
pnpm bundle:analyze      # build with visualization
pnpm bundle:save         # save current bundle as baseline
pnpm bundle:diff         # compare against baseline
```

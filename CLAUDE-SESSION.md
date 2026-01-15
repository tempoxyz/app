# Claude Session Notes

## 2026-01-14

### Completed

- Made balances API optional (Assets/Fee Token sections hidden when not configured)
- Commented out `VITE_BALANCES_API_URL` in `.env` so it's not set by default
- Removed unused light/dark mode toggle env var from `.env` and `.env.example`
- Removed `reset.d.ts`
- Added basic README

### From tempo-apps/apps/app (migrated here)

- Presto RPC authentication with custom viem transport (HTTP Basic Auth)
- Balances API integration with USD prices (`/tokens`, `/balances/:account`)
- Hide zero balances toggle (hidden by default)
- Sort assets by value (descending)
- Grid alignment using CSS subgrid
- Responsive layout (Amount/Value stacked below 768px)
- Text overflow with ellipsis and title tooltips
- Focus ring on scrollable area
- Chain-aware demo accounts (presto vs default)
- Empty state for assets
- Less prominent Send button styling

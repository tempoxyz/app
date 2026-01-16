# AGENTS.md

## **IMPORTANT**

- after any code changes, run `pnpm check && pnpm check:types` to ensure there are no lint or type errors.
- when adding any new feature, first consult the relevant [architecture](#architecture) sections and see if there's already a native API you can use.
- **_always_** use the most up-to-date APIs instead of defaulting to what shows up the most in your training. Some examples:
  - when writing React code to restore the state of hidden components, use React 19's [`<Activity>`](https://react.dev/reference/react/Activity#restoring-the-state-of-hidden-components) component instead of doing something like `{isShowingFoo && <Foo />}`.
  - when writing Wagmi React code to get the account address, use the [`useConnection`](https://wagmi.sh/react/api/hooks/useConnection.md) hook instead of the deprecated [`useAccount`](https://wagmi.sh/react/guides/migrate-from-v2-to-v3.md) hook.

## Commands

Commands are defined in [package.json](./package.json) under the `scripts` section.

## Architecture

- **Server-Side JavaScript Runtimes**:
  - [Cloudflare Workers](https://developers.cloudflare.com/llms.txt)
- **Meta-Framework**:
  - [TanStack Start](https://context7.com/websites/tanstack_start/llms.txt?tokens=1000000)
  - [TanStack Router](https://context7.com/websites/tanstack_router/llms.txt?tokens=1000000)
- **UI Framework**:
  - [React](https://context7.com/websites/react_dev/llms.txt?tokens=1000000)
- **Styling**:
  - [Tailwind CSS v4](https://context7.com/websites/tailwindcss/llms.txt?tokens=1000000)
- **Auth & Web3**
  - Wagmi:
    - [React reference](https://context7.com/websites/wagmi_sh_react/llms.txt?tokens=1000000)
    - [Tempo reference](https://context7.com/websites/wagmi_sh_tempo_getting-started/llms.txt?tokens=1000000)
  - Viem:
    - [General reference](https://viem.sh/llms.txt)
    - [Tempo reference](https://context7.com/websites/viem_sh_tempo/llms.txt?tokens=1000000)

## Utilities

- `zod/mini` for type checking (import using `import * as z from 'zod/mini'`)

## Code Style

- **Formatter**: Biome with tabs, single quotes, no semicolons
- **Imports**: Use `#*` alias for `src/*` (e.g., `import { cx } from '#lib/css'`)
- **Icons**: `unplugin-icons` with `~icons/` prefix (e.g., `~icons/lucide/music-4`)
- **Components**: PascalCase in `src/comps/`, utilities in `src/lib/`
- **Types**: Strict mode, no unused locals/params, prefer type imports with `type` keyword

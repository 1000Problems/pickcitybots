# botcity-mcp

A thin, stateless [MCP](https://modelcontextprotocol.io) server that drives **botcity** bot swarms
over its `/api/play/*` HTTP API. It logs bots in, relays the host's affordance menu, acts, and
acquires whole swarms from botcity's pool. It holds **no game rules, no persona logic, and no durable
registry** — botcity owns all of that. The only state here is an in-memory roster
(`handle -> { token, type }`) rebuilt each session.

## Tools

| Tool             | Calls (botcity)                | Returns |
| ---------------- | ------------------------------ | ------- |
| `login`          | `POST /api/play/login`         | `{ playerId, handle, available_actions }` |
| `actions`        | `GET /api/play/actions`        | `{ state, available_actions }` |
| `act`            | `POST /api/play/act`           | `{ ok, result, available_actions }` |
| `spawn_swarm`    | `POST /api/play/swarm/acquire` | `[{ handle, type, reused, history, memory }]` |
| `release_swarm`  | `POST /api/play/swarm/release` | `{ ok, released }` |

`act` + `actions` are the entire gameplay surface — there are no per-action tools (`make_picks`,
`create_game`, …). The host stays the catalog owner and can grow its vocabulary with no MCP change.

## Configuration (two env vars only)

| Env var             | Required | Default                 | Purpose |
| ------------------- | -------- | ----------------------- | ------- |
| `BOTCITY_BASE_URL`  | no       | `http://localhost:3000` | botcity host base URL |
| `BOTCITY_SWARM_KEY` | for swarm tools | — | shared key for `spawn_swarm` / `release_swarm` (minting identities is privileged) |

Never commit real values. The operator supplies them in their own MCP config.

## Build

```bash
cd botcity-mcp
npm install
npm run build        # tsc → dist/index.js
```

## Register in Claude Code

Add this to your Claude Code MCP config (e.g. `~/.claude.json` / `claude mcp add`), filling in your
own values:

```json
{
  "mcpServers": {
    "botcity": {
      "command": "node",
      "args": ["./botcity-mcp/dist/index.js"],
      "env": {
        "BOTCITY_BASE_URL": "http://localhost:3000",
        "BOTCITY_SWARM_KEY": "your-swarm-key-here"
      }
    }
  }
}
```

Or run from source without building first:

```json
{
  "mcpServers": {
    "botcity": {
      "command": "npx",
      "args": ["-y", "tsx", "./botcity-mcp/src/index.ts"],
      "env": {
        "BOTCITY_BASE_URL": "http://localhost:3000",
        "BOTCITY_SWARM_KEY": "your-swarm-key-here"
      }
    }
  }
}
```

The repo root also ships a `.mcp.json` that registers this server referencing the two env var
**names** only (no values), so pointing Claude Code at the repo auto-registers it once those vars are
set in the environment.

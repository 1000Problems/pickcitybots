# ⚠️ Moved — this folder is deprecated

The MCP server no longer runs locally. It now lives **inside botcity** and is served remotely over
Streamable HTTP at:

```
https://botcity.hadmoney.com/api/mcp
```

The repo root `.mcp.json` already registers it by URL, so there is nothing here to install, build, or
run. The five tools (`login`, `actions`, `act`, `spawn_swarm`, `release_swarm`) are unchanged — they
just execute on the host now.

**Cleanup:** this `botcity-mcp/` directory is leftover and should be removed from the repo:

```
git rm -r botcity-mcp
git commit -m "Remove local stdio MCP — served remotely by botcity at /api/mcp"
```

See `../SWARM-DRIVER.md` for how to drive a swarm against the remote server.

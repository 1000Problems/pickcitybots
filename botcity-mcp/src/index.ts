#!/usr/bin/env node
/**
 * DEPRECATED — tombstone stub.
 *
 * This local stdio MCP server no longer exists. The botcity MCP is now REMOTE,
 * hosted by botcity and served over Streamable HTTP at:
 *
 *   https://botcity.hadmoney.com/api/mcp
 *
 * There is nothing to build, install, or run here. The repo root `.mcp.json`
 * already registers the remote server by URL, or register it directly:
 *
 *   claude mcp add --transport http botcity https://botcity.hadmoney.com/api/mcp
 *
 * This `botcity-mcp/` folder is leftover and should be removed from the repo:
 *
 *   git rm -r botcity-mcp
 *
 * See ../SWARM-DRIVER.md to drive a swarm against the remote server.
 */

console.error(
  "botcity-mcp is deprecated. The MCP is remote at https://botcity.hadmoney.com/api/mcp. " +
    "Run `git rm -r botcity-mcp` to delete this dead folder."
);
process.exit(1);

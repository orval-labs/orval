# Orval AI Agent Skills

Official AI agent skill for generating type-safe API clients, hooks, schemas, mocks, and server handlers from OpenAPI specs using [Orval](https://orval.dev).

Skills are automatically discovered and used by the agent based on context — they don't appear in slash-command menus.

## Installation

### Claude Code

```bash
/plugin marketplace add orval-labs/orval
```

### Cursor

Add a remote GitHub rule pointing to this repository.

### Any agent (skills.sh)

```bash
npx skills add orval-labs/orval
```

## What's Included

The `orval` skill covers:

- All clients: React/Vue/Svelte/Solid/Angular Query, SWR, Fetch, Axios, Hono, MCP
- Zod schema generation and runtime validation
- MSW mock generation with test setup patterns
- Custom HTTP mutators and authentication patterns
- Hono server handlers with response validation
- NDJSON streaming, programmatic API, and advanced configuration

## Structure

```
skills/orval/
├── SKILL.md               # Core skill (always loaded)
├── tanstack-query.md      # React/Vue/Svelte/Solid Query, SWR
├── angular.md             # Angular Query and HttpClient
├── solid-start.md         # SolidStart query/action primitives
├── hono.md                # Hono server handlers
├── custom-http-clients.md # Custom mutators, auth patterns
├── zod-validation.md      # Zod schema generation
├── mocking-msw.md         # MSW mocks and test setup
├── advanced-config.md     # Type generation, overrides, enums
└── tooling-workflow.md    # MCP, NDJSON, hooks, programmatic API
```

Reference files are loaded on demand when the user's question matches the topic.

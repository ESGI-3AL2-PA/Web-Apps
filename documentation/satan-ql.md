# SATAN QL — Custom Query Language for MongoDB

## Overview

`@repo/satan` is a monorepo package that introduces a custom SQL-like query language (SATAN QL) compiled to MongoDB queries at runtime. A Python lex/yacc parser (PLY) handles parsing. The two communicate over stdin/stdout: Node spawns a single Python process at startup, keeps it alive, and sends newline-delimited JSON requests.

The library is consumed by `apps/api` through the existing clean architecture (repository → use-case → route).

---

## Query Language

**Example queries:**

```
FIND users WHERE role = "admin" AND name LIKE "Jo*" LIMIT 10 ORDER BY createdAt DESC
FIND users WHERE profile.address.city = "Paris" SELECT id, name, email
FIND users WHERE role IN ("admin", "moderator") AND email EXISTS
FIND users WHERE age >= 18 AND NOT (role = "user") ORDER BY name ASC, createdAt DESC SKIP 20 LIMIT 50
```

---

## Architecture

```
apps/api (TypeScript / Express)
        │
        │  createSatanClient()
        ▼
@repo/satan — SatanClient
        │
        │  child_process.spawn (once, kept alive)
        │  stdin: { "id": "uuid", "query": "FIND users WHERE ..." }\n
        │  stdout: { "id": "uuid", "ok": true, "result": {...} }\n
        ▼
packages/SATAN/python/worker.py
        │
        ├── lexer.py    (PLY tokeniser)
        ├── parser.py   (PLY grammar → AST)
        └── translator.py (AST → MongoDB query dict)
        │
        │  returns Mongo query JSON result
        ▼
MongoDB
```

The Python process reads until stdin closes (Node exits), then terminates naturally. Node auto-restarts the process on crash up.

---

## Package Structure

```
packages/SATAN/
├── package.json                     # name: @repo/satan
├── tsconfig.json                    # extends @repo/typescript-config
├── requirements.txt                 # ply, pytest
│
├── python/
│   ├── __init__.py
│   ├── worker.py                    # stdin/stdout JSON loop — subprocess entry point
│   ├── lexer.py                     # PLY token definitions
│   ├── parser.py                    # PLY grammar rules → AST
│   ├── ast_nodes.py                 # Dataclass AST node types
│   ├── translator.py                # AST → MongoDB query dict
│   ├── errors.py                    # SatanParseError, SatanLexError
│   └── tests/
│       ├── test_lexer.py
│       ├── test_parser.py
│       └── test_translator.py
│
├── src/
│   ├── index.ts                     # Public exports
│   ├── types.ts                     # MongoQuery, SatanClientOptions
│   ├── process-manager.ts           # Subprocess lifecycle, request queuing
│   ├── client.ts                    # Public SatanClient
│   └── errors.ts                    # SatanError, SatanParseError, SatanWorkerError
│
└── dist/                            # tsc output (gitignored)
```

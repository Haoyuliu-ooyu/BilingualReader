# Codebase Structure

## Directory Layout

```
BilingualReader/
├── apps/
│   ├── gateway/          # Go REST API service
│   │   ├── handlers/     # HTTP route handlers + middleware
│   │   ├── models/       # Database models (GORM structs)
│   │   ├── services/     # Business logic (crypto, S3, auth)
│   │   ├── main.go       # Entry point, router setup, schema init
│   │   ├── go.mod        # Go module dependencies
│   │   └── Dockerfile
│   ├── worker/           # Python processing service
│   │   ├── pipeline/     # Translation pipeline modules
│   │   │   ├── llm_client.py         # Unified LLM interface
│   │   │   ├── context_agent.py      # World Bible generation
│   │   │   ├── translation_agent.py  # Chunk-based translation
│   │   │   └── pdf_extraction.py     # PyMuPDF text extraction
│   │   ├── main.py       # Entry point, Redis consumer loop
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   └── web/              # React SPA frontend
│       ├── src/
│       │   ├── components/   # React components
│       │   ├── stores/       # Zustand state stores
│       │   ├── services/     # API client functions
│       │   ├── types/        # TypeScript type definitions
│       │   ├── App.tsx       # Root component + routing
│       │   └── main.tsx      # Entry point
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       └── Dockerfile
├── docker-compose.yml    # Full stack orchestration
├── .env.example          # Environment variable template
└── CLAUDE.md             # AI assistant instructions
```

## Key Locations

| What | Where |
|------|-------|
| API routes | `apps/gateway/handlers/` |
| Auth middleware | `apps/gateway/handlers/middleware.go` |
| Database models | `apps/gateway/models/` |
| Crypto (AES-256-GCM) | `apps/gateway/services/crypto.go` |
| S3 upload | `apps/gateway/services/s3.go` |
| Redis job consumer | `apps/worker/main.py` |
| LLM abstraction | `apps/worker/pipeline/llm_client.py` |
| Translation pipeline | `apps/worker/pipeline/translation_agent.py` |
| Context/glossary agent | `apps/worker/pipeline/context_agent.py` |
| PDF text extraction | `apps/worker/pipeline/pdf_extraction.py` |
| Frontend state | `apps/web/src/stores/` |
| API client | `apps/web/src/services/` |
| UI components | `apps/web/src/components/` |
| Docker config | `docker-compose.yml` |
| Environment vars | `.env.example` |

## Naming Conventions

| Language | Convention | Example |
|----------|-----------|---------|
| Go (exported) | PascalCase | `AuthRequired`, `UploadDocument` |
| Go (unexported) | camelCase | `parseToken`, `getUser` |
| Python | snake_case | `translate_segment`, `llm_client` |
| TypeScript | camelCase (vars/functions) | `fetchDocuments`, `useAuthStore` |
| TypeScript | PascalCase (components/types) | `DocumentViewer`, `TranslationStatus` |
| Files (Go) | snake_case | `middleware.go`, `crypto.go` |
| Files (Python) | snake_case | `llm_client.py`, `context_agent.py` |
| Files (React) | PascalCase (components) | `DocumentViewer.tsx` |

## Path Aliases

- `@/` maps to `apps/web/src/` (configured in `tsconfig.json` and `vite.config.ts`)

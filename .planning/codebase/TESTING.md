# Testing

## Current State

**No test infrastructure exists.** The codebase has no test files, test frameworks, or test configurations across any of the three services.

## Evidence

- No `*_test.go` files in `apps/gateway/`
- No `*_test.py` or `test_*.py` files in `apps/worker/`
- No `*.test.ts`, `*.test.tsx`, `*.spec.ts`, or `*.spec.tsx` files in `apps/web/`
- No test runner configured in any `package.json`, `go.mod`, or `requirements.txt`
- No CI/CD pipeline configured for automated testing
- `npm run build` runs `tsc -b && vite build` (type checking only, no tests)

## Build-Time Checks

| Service | Check | Command |
|---------|-------|---------|
| Web | TypeScript type checking | `tsc -b` (via `npm run build`) |
| Web | ESLint | `npm run lint` |
| Gateway | Go compilation | `go build` |
| Worker | None | No static analysis configured |

## Test Coverage Gaps

| Area | Risk Level | Description |
|------|------------|-------------|
| Auth flow | High | JWT generation, validation, and middleware untested |
| Encryption | High | AES-256-GCM encrypt/decrypt of API keys untested |
| LLM client | High | Multi-provider abstraction has no unit tests |
| Translation pipeline | High | Core business logic completely untested |
| PDF extraction | Medium | Text extraction accuracy not validated |
| API endpoints | Medium | No integration tests for REST API |
| Frontend components | Medium | No component or E2E tests |
| Database operations | Medium | GORM model operations untested |
| Redis job queue | Low | Simple BLPOP/LPUSH pattern |

## Recommendations

- **Go**: Use built-in `testing` package + `httptest` for handler tests
- **Python**: Use `pytest` with fixtures for pipeline testing
- **React**: Use Vitest (already compatible with Vite) + React Testing Library
- **E2E**: Consider Playwright for full-stack integration tests
- **CI**: Add GitHub Actions workflow for automated test runs

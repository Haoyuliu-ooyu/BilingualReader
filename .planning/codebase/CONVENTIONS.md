# Code Conventions

## Language-Specific Patterns

### Go (Gateway)

- **Framework**: Gin web framework for HTTP routing
- **ORM**: GORM for database access
- **Error handling**: Standard Go error returns, wrapped with `fmt.Errorf` or returned directly
- **Logging**: `log` stdlib package
- **Response format**: `c.JSON(statusCode, gin.H{...})` pattern throughout handlers
- **Auth**: JWT tokens (HS256) with 7-day expiry via `golang-jwt/jwt`
- **Naming**: Exported functions PascalCase, unexported camelCase

### Python (Worker)

- **Style**: snake_case throughout, PEP 8 conventions
- **Error handling**: try/except blocks, errors logged with `print()` statements
- **Async**: Not used; worker runs synchronously with `BLPOP` blocking loop
- **Dependencies**: Direct imports, no dependency injection framework
- **Logging**: `print()` statements (no structured logging framework)
- **Config**: Environment variables accessed via `os.environ` / `os.getenv()`

### TypeScript/React (Web)

- **Framework**: React 19 with functional components and hooks
- **State management**: Zustand stores (not Redux)
- **Styling**: Tailwind CSS utility classes
- **Build**: Vite with TypeScript checking via `tsc -b`
- **Linting**: ESLint configured (run via `npm run lint`)
- **Imports**: Path alias `@/` for `src/` directory
- **API calls**: Fetch-based service functions in `src/services/`

## Common Patterns

### API Response Format (Gateway)
```go
// Success
c.JSON(http.StatusOK, gin.H{"data": result})

// Error
c.JSON(http.StatusBadRequest, gin.H{"error": "message"})
```

### State Store Pattern (Frontend)
```typescript
// Zustand store pattern
const useStore = create<StoreType>((set) => ({
  state: initialValue,
  action: () => set({ state: newValue }),
}))
```

### LLM Client Pattern (Worker)
```python
# Unified interface across providers
client = LLMClient(provider, api_key)
response = client.generate(prompt, model)
```

## Import Organization

- **Go**: stdlib first, then third-party, then local packages
- **Python**: stdlib, third-party, local (standard PEP 8)
- **TypeScript**: React/libraries first, then `@/` aliased imports, then relative imports

## Error Handling Strategy

| Layer | Approach |
|-------|----------|
| Gateway handlers | Return JSON error responses with appropriate HTTP status codes |
| Gateway services | Return Go errors, handled by caller |
| Worker pipeline | try/except with print logging; checkpointing for resumability |
| Frontend | try/catch around API calls; error state in Zustand stores |

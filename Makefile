.PHONY: dev dev-down dev-logs

# Start all services for local development
# env_file directives in docker-compose.yml load .env.dev (infra) + .env (secrets)
dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Stop all services
dev-down:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down

# Tail logs from all services
dev-logs:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f

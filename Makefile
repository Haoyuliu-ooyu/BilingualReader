.PHONY: dev dev-down dev-logs deploy deploy-service deploy-frontend status

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

# Deploy all services to prod
deploy:
	./deploy.sh all

# Deploy a single service (usage: make deploy-service SERVICE=gateway)
deploy-service:
	./deploy.sh all --service $(SERVICE)

# Deploy frontend to S3 + CloudFront
deploy-frontend:
	./deploy.sh frontend

# Show ECS service status
status:
	./deploy.sh status


#!/bin/bash
set -euo pipefail

# ─── Configuration ────────────────────────────────────────
AWS_REGION="${AWS_REGION:-us-east-1}"
PROJECT="${PROJECT:-prism}"
ENVIRONMENT="${ENVIRONMENT:-prod}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_BASE="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Service names match ECR repository names
SERVICES=("web" "gateway" "worker")

# Map service names to build context directories
declare -A BUILD_CONTEXTS=(
  ["web"]="apps/web"
  ["gateway"]="apps/gateway"
  ["worker"]="apps/worker"
)

# Build args for specific services
declare -A BUILD_ARGS=(
  ["web"]="--build-arg VITE_API_URL=http://$(terraform -chdir=infra/environments/${ENVIRONMENT} output -raw alb_url 2>/dev/null || echo 'ALB_URL_PENDING')/api"
  ["gateway"]=""
  ["worker"]=""
)

# ─── Functions ────────────────────────────────────────────

usage() {
  echo "Usage: $0 [command] [options]"
  echo ""
  echo "Commands:"
  echo "  build       Build Docker images"
  echo "  push        Push images to ECR"
  echo "  deploy      Force new ECS deployment"
  echo "  all         Build + Push + Deploy (default)"
  echo "  status      Show current ECS service status"
  echo ""
  echo "Options:"
  echo "  --service   Deploy a single service (web|gateway|worker)"
  echo "  --tag       Image tag (default: latest)"
  echo "  --env       Environment (default: staging)"
  echo ""
  echo "Examples:"
  echo "  $0 all                          # Full deploy of all services"
  echo "  $0 build --service gateway      # Build only gateway"
  echo "  $0 deploy --service worker      # Redeploy only worker"
  echo "  $0 all --env prod --tag v1.2.3  # Deploy specific tag to prod"
}

ecr_login() {
  echo "🔑 Logging into ECR..."
  aws ecr get-login-password --region "${AWS_REGION}" | \
    docker login --username AWS --password-stdin "${ECR_BASE}"
}

build_images() {
  local services=("$@")
  for service in "${services[@]}"; do
    local context="${BUILD_CONTEXTS[$service]}"
    local args="${BUILD_ARGS[$service]:-}"
    echo "🔨 Building ${service} from ${context}..."
    docker build ${args} \
      -t "${PROJECT}/${service}:${IMAGE_TAG}" \
      "./${context}/"
  done
}

push_images() {
  local services=("$@")
  ecr_login
  for service in "${services[@]}"; do
    local repo="${ECR_BASE}/${PROJECT}/${service}"
    echo "📦 Pushing ${service} → ${repo}:${IMAGE_TAG}..."
    docker tag "${PROJECT}/${service}:${IMAGE_TAG}" "${repo}:${IMAGE_TAG}"
    docker push "${repo}:${IMAGE_TAG}"
  done
}

deploy_services() {
  local services=("$@")
  for service in "${services[@]}"; do
    echo "🚀 Deploying ${service}..."
    aws ecs update-service \
      --cluster "${PROJECT}-${ENVIRONMENT}-cluster" \
      --service "${PROJECT}-${ENVIRONMENT}-${service}" \
      --force-new-deployment \
      --region "${AWS_REGION}" \
      --no-cli-pager
  done
  echo ""
  echo "✅ Deployment triggered! Monitor at:"
  echo "   https://${AWS_REGION}.console.aws.amazon.com/ecs/v2/clusters/${PROJECT}-${ENVIRONMENT}-cluster/services"
}

show_status() {
  echo "📊 ECS Service Status (${ENVIRONMENT}):"
  echo ""
  for service in "${SERVICES[@]}"; do
    local status=$(aws ecs describe-services \
      --cluster "${PROJECT}-${ENVIRONMENT}-cluster" \
      --services "${PROJECT}-${ENVIRONMENT}-${service}" \
      --query 'services[0].{desired:desiredCount,running:runningCount,status:status}' \
      --output table \
      --region "${AWS_REGION}" 2>/dev/null || echo "  Not found")
    echo "  ${service}: ${status}"
  done
}

# ─── Parse Arguments ──────────────────────────────────────

COMMAND="${1:-all}"
shift || true

TARGET_SERVICES=("${SERVICES[@]}")

while [[ $# -gt 0 ]]; do
  case $1 in
    --service) TARGET_SERVICES=("$2"); shift 2 ;;
    --tag)     IMAGE_TAG="$2"; shift 2 ;;
    --env)     ENVIRONMENT="$2"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *)         echo "Unknown option: $1"; usage; exit 1 ;;
  esac
done

# ─── Execute ──────────────────────────────────────────────

case $COMMAND in
  build)
    build_images "${TARGET_SERVICES[@]}"
    ;;
  push)
    push_images "${TARGET_SERVICES[@]}"
    ;;
  deploy)
    deploy_services "${TARGET_SERVICES[@]}"
    ;;
  all)
    build_images "${TARGET_SERVICES[@]}"
    push_images "${TARGET_SERVICES[@]}"
    deploy_services "${TARGET_SERVICES[@]}"
    ;;
  status)
    show_status
    ;;
  *)
    echo "Unknown command: $COMMAND"
    usage
    exit 1
    ;;
esac

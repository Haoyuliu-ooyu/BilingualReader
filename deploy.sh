#!/bin/bash
set -euo pipefail

# ─── Configuration ────────────────────────────────────────
AWS_REGION="${AWS_REGION:-us-east-1}"
PROJECT="${PROJECT:-prism}"
ENVIRONMENT="${ENVIRONMENT:-prod}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_BASE="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Backend services only (frontend is S3 + CloudFront)
SERVICES=("gateway" "worker")

# Contexts are simply apps/<service>

# ─── Functions ────────────────────────────────────────────

usage() {
  echo "Usage: $0 [command] [options]"
  echo ""
  echo "Commands:"
  echo "  build       Build Docker images (gateway, worker)"
  echo "  push        Push images to ECR"
  echo "  deploy      Force new ECS deployment"
  echo "  frontend    Build and deploy frontend to S3 + CloudFront"
  echo "  all         Build + Push + Deploy backend + Frontend"
  echo "  status      Show current ECS service status"
  echo ""
  echo "Options:"
  echo "  --service   Deploy a single backend service (gateway|worker)"
  echo "  --tag       Image tag (default: latest)"
  echo ""
  echo "Examples:"
  echo "  $0 all                          # Full deploy (backend + frontend)"
  echo "  $0 frontend                     # Deploy only frontend"
  echo "  $0 deploy --service gateway     # Redeploy only gateway"
}

ecr_login() {
  echo "🔑 Logging into ECR..."
  aws ecr get-login-password --region "${AWS_REGION}" | \
    docker login --username AWS --password-stdin "${ECR_BASE}"
}

build_images() {
  local services=("$@")
  for service in "${services[@]}"; do
    local context="apps/${service}"
    echo "🔨 Building ${service} from ${context}..."
    docker build --platform linux/arm64 -t "${PROJECT}/${service}:${IMAGE_TAG}" "./${context}/"
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
  echo "✅ Backend deployment triggered!"
}

deploy_frontend() {
  echo "🌐 Building frontend..."

  # Get the API Gateway URL via AWS CLI
  VITE_API_URL=$(aws apigatewayv2 get-apis --query "Items[?Name=='${PROJECT}-${ENVIRONMENT}-api'].ApiEndpoint | [0]" --output text)
  echo "   VITE_API_URL=${VITE_API_URL}"

  # Build
  cd apps/web
  VITE_API_URL="${VITE_API_URL}" npm run build
  cd ../..

  # Deterministic S3 bucket name
  FRONTEND_BUCKET="${PROJECT}-${ENVIRONMENT}-frontend-${AWS_ACCOUNT_ID}"
  
  # Get CloudFront distribution ID via AWS CLI
  CF_DIST_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[0].Id=='${FRONTEND_BUCKET}'].Id | [0]" --output text)
  if [ "$CF_DIST_ID" = "None" ]; then CF_DIST_ID=""; fi

  # Upload to S3
  echo "📤 Uploading to S3: ${FRONTEND_BUCKET}..."
  aws s3 sync apps/web/dist/ "s3://${FRONTEND_BUCKET}/" --delete

  # Invalidate CloudFront cache
  if [ -n "$CF_DIST_ID" ]; then
    echo "🔄 Invalidating CloudFront cache..."
    aws cloudfront create-invalidation \
      --distribution-id "${CF_DIST_ID}" \
      --paths "/*" \
      --no-cli-pager
  fi

  echo "✅ Frontend deployed!"
}

show_status() {
  echo "📊 ECS Service Status (${ENVIRONMENT}):"
  echo ""
  for service in "${SERVICES[@]}"; do
    echo "  ${service}:"
    aws ecs describe-services \
      --cluster "${PROJECT}-${ENVIRONMENT}-cluster" \
      --services "${PROJECT}-${ENVIRONMENT}-${service}" \
      --query 'services[0].{desired:desiredCount,running:runningCount,status:status}' \
      --output table \
      --region "${AWS_REGION}" 2>/dev/null || echo "    Not found"
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
    --help|-h) usage; exit 0 ;;
    *)         echo "Unknown option: $1"; usage; exit 1 ;;
  esac
done

# ─── Execute ──────────────────────────────────────────────

case $COMMAND in
  build)     build_images "${TARGET_SERVICES[@]}" ;;
  push)      push_images "${TARGET_SERVICES[@]}" ;;
  deploy)    deploy_services "${TARGET_SERVICES[@]}" ;;
  frontend)  deploy_frontend ;;
  all)
    build_images "${TARGET_SERVICES[@]}"
    push_images "${TARGET_SERVICES[@]}"
    deploy_services "${TARGET_SERVICES[@]}"
    deploy_frontend
    ;;
  status)    show_status ;;
  *)         echo "Unknown command: $COMMAND"; usage; exit 1 ;;
esac

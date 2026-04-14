terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "prism-terraform-state-301178568950"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "prism-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
}

# ─── Modules ─────────────────────────────────────────────

module "vpc" {
  source       = "../../modules/vpc"
  project_name = var.project_name
  environment  = var.environment
}

module "security_groups" {
  source       = "../../modules/security_groups"
  project_name = var.project_name
  environment  = var.environment
  vpc_id       = module.vpc.vpc_id
}

module "ecr" {
  source       = "../../modules/ecr"
  project_name = var.project_name
}

module "s3" {
  source       = "../../modules/s3"
  project_name = var.project_name
  environment  = var.environment
}

module "rds" {
  source             = "../../modules/rds"
  project_name       = var.project_name
  environment        = var.environment
  private_subnet_ids = module.vpc.private_subnet_ids
  security_group_id  = module.security_groups.rds_sg_id
  db_name            = var.db_name
  db_username        = var.db_username
  db_password        = var.db_password
}

module "sqs" {
  source       = "../../modules/sqs"
  project_name = var.project_name
  environment  = var.environment
}

module "cloudfront" {
  source        = "../../modules/cloudfront"
  project_name  = var.project_name
  environment   = var.environment
  custom_domain = var.custom_domain
}

locals {
  # Build CORS allowed origins: always include API GW + CloudFront default domain,
  # and optionally the custom CNAME domain if configured.
  base_origins = "${module.apigateway.api_url},https://${module.cloudfront.cloudfront_domain}"
  allowed_origins = var.custom_domain != "" ? "${local.base_origins},https://${var.custom_domain}" : local.base_origins
}

module "apigateway" {
  source             = "../../modules/apigateway"
  project_name       = var.project_name
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  ecs_sg_id          = module.security_groups.ecs_sg_id
}

module "secrets" {
  source       = "../../modules/secrets"
  project_name = var.project_name
  environment  = var.environment
}

module "iam" {
  source        = "../../modules/iam"
  project_name  = var.project_name
  environment   = var.environment
  s3_bucket_arn = module.s3.bucket_arn
  secret_arns   = module.secrets.all_secret_arns
  sqs_queue_arn = module.sqs.queue_arn
}

module "ecs" {
  source             = "../../modules/ecs"
  project_name       = var.project_name
  environment        = var.environment
  aws_region         = var.aws_region
  private_subnet_ids = module.vpc.private_subnet_ids
  ecs_sg_id          = module.security_groups.ecs_sg_id
  execution_role_arn = module.iam.execution_role_arn
  task_role_arn      = module.iam.task_role_arn
  service_registry_arn = module.apigateway.service_discovery_arn

  gateway_image = "${module.ecr.gateway_repo_url}:latest"
  worker_image  = "${module.ecr.worker_repo_url}:latest"

  db_url          = "postgresql://${var.db_username}:${var.db_password}@${module.rds.endpoint}/${var.db_name}?sslmode=require"
  s3_bucket       = module.s3.bucket_name
  sqs_queue_url   = module.sqs.queue_url
  allowed_origins = local.allowed_origins

  jwt_secret_arn     = module.secrets.jwt_secret_arn
  encryption_key_arn = module.secrets.encryption_key_arn
}

module "autoscaling" {
  source              = "../../modules/autoscaling"
  project_name        = var.project_name
  environment         = var.environment
  cluster_name        = module.ecs.cluster_name
  worker_service_name = module.ecs.worker_service_name
  sqs_queue_name      = module.sqs.queue_name
}

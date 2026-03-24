terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state in S3 — create this bucket manually before first `terraform init`
  backend "s3" {
    bucket         = "prism-terraform-state"
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

module "elasticache" {
  source             = "../../modules/elasticache"
  project_name       = var.project_name
  environment        = var.environment
  private_subnet_ids = module.vpc.private_subnet_ids
  security_group_id  = module.security_groups.redis_sg_id
}

module "secrets" {
  source       = "../../modules/secrets"
  project_name = var.project_name
  environment  = var.environment
}

module "iam" {
  source       = "../../modules/iam"
  project_name = var.project_name
  environment  = var.environment
  s3_bucket_arn = module.s3.bucket_arn
  secret_arns  = module.secrets.all_secret_arns
}

module "alb" {
  source            = "../../modules/alb"
  project_name      = var.project_name
  environment       = var.environment
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  alb_sg_id         = module.security_groups.alb_sg_id
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

  web_image     = "${module.ecr.web_repo_url}:latest"
  gateway_image = "${module.ecr.gateway_repo_url}:latest"
  worker_image  = "${module.ecr.worker_repo_url}:latest"

  web_tg_arn     = module.alb.web_tg_arn
  gateway_tg_arn = module.alb.gateway_tg_arn

  db_url          = "postgresql://${var.db_username}:${var.db_password}@${module.rds.endpoint}/${var.db_name}?sslmode=require"
  redis_url       = "rediss://${module.elasticache.primary_endpoint}:6379/0"
  s3_bucket       = module.s3.bucket_name
  allowed_origins = var.allowed_origins

  jwt_secret_arn     = module.secrets.jwt_secret_arn
  encryption_key_arn = module.secrets.encryption_key_arn
}

module "autoscaling" {
  source              = "../../modules/autoscaling"
  project_name        = var.project_name
  environment         = var.environment
  cluster_name        = module.ecs.cluster_name
  worker_service_name = module.ecs.worker_service_name
}

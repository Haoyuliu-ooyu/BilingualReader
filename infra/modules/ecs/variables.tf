variable "project_name" { type = string }
variable "environment" { type = string }
variable "aws_region" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "ecs_sg_id" { type = string }
variable "execution_role_arn" { type = string }
variable "task_role_arn" { type = string }

# ECR image URLs
variable "web_image" { type = string }
variable "gateway_image" { type = string }
variable "worker_image" { type = string }

# ALB target groups
variable "web_tg_arn" { type = string }
variable "gateway_tg_arn" { type = string }

# Service config
variable "db_url" { type = string, sensitive = true }
variable "redis_url" { type = string }
variable "s3_bucket" { type = string }
variable "allowed_origins" { type = string }

# Secrets Manager ARNs
variable "jwt_secret_arn" { type = string }
variable "encryption_key_arn" { type = string }

# Resource sizing
variable "web_cpu" { type = number, default = 256 }
variable "web_memory" { type = number, default = 512 }
variable "gateway_cpu" { type = number, default = 512 }
variable "gateway_memory" { type = number, default = 1024 }
variable "worker_cpu" { type = number, default = 512 }
variable "worker_memory" { type = number, default = 1024 }

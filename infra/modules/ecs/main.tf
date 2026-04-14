resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# --- CloudWatch Log Groups ---
resource "aws_cloudwatch_log_group" "gateway" {
  name              = "/ecs/${var.project_name}-${var.environment}/gateway"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${var.project_name}-${var.environment}/worker"
  retention_in_days = 30
}

# ─── GATEWAY (Backend — public subnet with public IP) ────
resource "aws_ecs_task_definition" "gateway" {
  family                   = "${var.project_name}-${var.environment}-gateway"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.gateway_cpu
  memory                   = var.gateway_memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }


  container_definitions = jsonencode([{
    name  = "gateway"
    image = var.gateway_image
    portMappings = [{ containerPort = 8080, protocol = "tcp" }]

    environment = [
      { name = "DB_URL",          value = var.db_url },
      { name = "S3_BUCKET",       value = var.s3_bucket },
      { name = "S3_REGION",       value = var.aws_region },
      { name = "AWS_REGION",      value = var.aws_region },
      { name = "QUEUE_DRIVER",    value = "sqs" },
      { name = "SQS_QUEUE_URL",   value = var.sqs_queue_url },
      { name = "ALLOWED_ORIGINS", value = var.allowed_origins },
    ]

    secrets = [
      { name = "JWT_SECRET",                valueFrom = var.jwt_secret_arn },
      { name = "LLM_KEY_ENCRYPTION_SECRET", valueFrom = var.encryption_key_arn },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.gateway.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "gateway"
      }
    }
  }])
}

resource "aws_ecs_service" "gateway" {
  name            = "${var.project_name}-${var.environment}-gateway"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.gateway.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [var.ecs_sg_id]
  }

  service_registries {
    registry_arn   = var.service_registry_arn
    container_name = "gateway"
    container_port = 8080
  }
}

# ─── WORKER (private subnet, SQS-driven) ────────────────
resource "aws_ecs_task_definition" "worker" {
  family                   = "${var.project_name}-${var.environment}-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([{
    name  = "worker"
    image = var.worker_image

    environment = [
      { name = "DB_URL",        value = var.db_url },
      { name = "S3_BUCKET",     value = var.s3_bucket },
      { name = "S3_REGION",     value = var.aws_region },
      { name = "AWS_REGION",    value = var.aws_region },
      { name = "QUEUE_DRIVER",  value = "sqs" },
      { name = "SQS_QUEUE_URL", value = var.sqs_queue_url },
    ]

    secrets = [
      { name = "LLM_KEY_ENCRYPTION_SECRET", valueFrom = var.encryption_key_arn },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.worker.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "worker"
      }
    }
  }])
}

resource "aws_ecs_service" "worker" {
  name            = "${var.project_name}-${var.environment}-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = 0
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [var.ecs_sg_id]
  }

  lifecycle {
    ignore_changes = [desired_count]
  }
}

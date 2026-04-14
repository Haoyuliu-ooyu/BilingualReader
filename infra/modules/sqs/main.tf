resource "aws_sqs_queue" "tasks_dlq" {
  name = "${var.project_name}-${var.environment}-tasks-dlq"
  tags = { Name = "${var.project_name}-${var.environment}-tasks-dlq" }
}

resource "aws_sqs_queue" "tasks" {
  name                       = "${var.project_name}-${var.environment}-tasks"
  visibility_timeout_seconds = 3600         # 1 hour — long-running translation jobs
  message_retention_seconds  = 86400        # 24 hours
  receive_wait_time_seconds  = 20           # long polling

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.tasks_dlq.arn
    maxReceiveCount     = 3
  })

  tags = { Name = "${var.project_name}-${var.environment}-tasks" }
}

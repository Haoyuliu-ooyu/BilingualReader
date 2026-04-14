# Register the worker service as a scalable target (0 to max_capacity)
resource "aws_appautoscaling_target" "worker" {
  max_capacity       = var.max_capacity
  min_capacity       = 0
  resource_id        = "service/${var.cluster_name}/${var.worker_service_name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# ─── SCALE UP: SQS has messages → spin up workers ───────
resource "aws_appautoscaling_policy" "worker_scale_up" {
  name               = "${var.project_name}-${var.environment}-worker-scale-up"
  policy_type        = "StepScaling"
  resource_id        = aws_appautoscaling_target.worker.resource_id
  scalable_dimension = aws_appautoscaling_target.worker.scalable_dimension
  service_namespace  = aws_appautoscaling_target.worker.service_namespace

  step_scaling_policy_configuration {
    adjustment_type         = "ExactCapacity"
    cooldown                = 60
    metric_aggregation_type = "Maximum"

    step_adjustment {
      metric_interval_lower_bound = 0
      metric_interval_upper_bound = 10
      scaling_adjustment          = 1
    }
    step_adjustment {
      metric_interval_lower_bound = 10
      metric_interval_upper_bound = 50
      scaling_adjustment          = 2
    }
    step_adjustment {
      metric_interval_lower_bound = 50
      scaling_adjustment          = var.max_capacity
    }
  }
}

resource "aws_cloudwatch_metric_alarm" "worker_queue_high" {
  alarm_name          = "${var.project_name}-${var.environment}-sqs-queue-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_actions       = [aws_appautoscaling_policy.worker_scale_up.arn]

  dimensions = {
    QueueName = var.sqs_queue_name
  }
}

# ─── SCALE DOWN: SQS empty AND no in-flight for 5 min → scale to zero ────
resource "aws_appautoscaling_policy" "worker_scale_down" {
  name               = "${var.project_name}-${var.environment}-worker-scale-down"
  policy_type        = "StepScaling"
  resource_id        = aws_appautoscaling_target.worker.resource_id
  scalable_dimension = aws_appautoscaling_target.worker.scalable_dimension
  service_namespace  = aws_appautoscaling_target.worker.service_namespace

  step_scaling_policy_configuration {
    adjustment_type         = "ExactCapacity"
    cooldown                = 300
    metric_aggregation_type = "Maximum"

    step_adjustment {
      metric_interval_upper_bound = 0
      scaling_adjustment          = 0
    }
  }
}

# Use a math expression alarm that sums visible + in-flight messages.
# This prevents scaling to zero while a worker is actively processing a job.
resource "aws_cloudwatch_metric_alarm" "worker_queue_empty" {
  alarm_name          = "${var.project_name}-${var.environment}-sqs-queue-empty"
  comparison_operator = "LessThanOrEqualToThreshold"
  evaluation_periods  = 5
  threshold           = 0
  alarm_actions       = [aws_appautoscaling_policy.worker_scale_down.arn]

  # Visible messages waiting in the queue
  metric_query {
    id = "visible"

    metric {
      metric_name = "ApproximateNumberOfMessagesVisible"
      namespace   = "AWS/SQS"
      period      = 60
      stat        = "Maximum"

      dimensions = {
        QueueName = var.sqs_queue_name
      }
    }
  }

  # In-flight messages (received by a consumer but not yet deleted)
  metric_query {
    id = "inflight"

    metric {
      metric_name = "ApproximateNumberOfMessagesNotVisible"
      namespace   = "AWS/SQS"
      period      = 60
      stat        = "Maximum"

      dimensions = {
        QueueName = var.sqs_queue_name
      }
    }
  }

  # Only alarm (scale down) when BOTH visible and in-flight are zero
  metric_query {
    id          = "total"
    expression  = "visible + inflight"
    label       = "Total Messages (visible + in-flight)"
    return_data = true
  }
}

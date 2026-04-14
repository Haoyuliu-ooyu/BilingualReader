output "queue_url" { value = aws_sqs_queue.tasks.url }
output "queue_arn" { value = aws_sqs_queue.tasks.arn }
output "queue_name" { value = aws_sqs_queue.tasks.name }
output "dlq_arn" { value = aws_sqs_queue.tasks_dlq.arn }

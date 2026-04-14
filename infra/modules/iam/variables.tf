variable "project_name" { type = string }
variable "environment" { type = string }
variable "s3_bucket_arn" { type = string }
variable "secret_arns" { type = list(string) }
variable "sqs_queue_arn" { type = string }

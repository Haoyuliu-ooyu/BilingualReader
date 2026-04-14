variable "project_name" { type = string }
variable "environment" { type = string }
variable "cluster_name" { type = string }
variable "worker_service_name" { type = string }
variable "sqs_queue_name" { type = string }
variable "max_capacity" {
  type    = number
  default = 5
}

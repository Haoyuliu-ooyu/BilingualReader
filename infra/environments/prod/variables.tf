variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "prism"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "db_name" {
  type    = string
  default = "prism"
}

variable "db_username" {
  type      = string
  sensitive = true
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "allowed_origins" {
  type        = string
  description = "Comma-separated allowed CORS origins"
  default     = "*"
}

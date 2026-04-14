variable "project_name" { type = string }
variable "environment" { type = string }
variable "custom_domain" {
  type        = string
  default     = ""
  description = "Custom domain linked to CloudFront via CNAME (e.g. reader.example.com)"
}

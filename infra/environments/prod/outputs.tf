output "api_url" {
  value       = module.apigateway.api_url
  description = "Public HTTPS URL for the API (use as VITE_API_URL)"
}

output "cloudfront_url" {
  value = "https://${module.cloudfront.cloudfront_domain}"
}

output "frontend_bucket" {
  value = module.cloudfront.frontend_bucket_name
}

output "cloudfront_distribution_id" {
  value = module.cloudfront.cloudfront_distribution_id
}

output "ecr_gateway_url" {
  value = module.ecr.gateway_repo_url
}

output "ecr_worker_url" {
  value = module.ecr.worker_repo_url
}

output "rds_endpoint" {
  value     = module.rds.endpoint
  sensitive = true
}

output "sqs_queue_url" {
  value = module.sqs.queue_url
}

output "s3_bucket" {
  value = module.s3.bucket_name
}

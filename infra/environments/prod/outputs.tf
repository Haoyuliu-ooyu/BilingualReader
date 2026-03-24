output "alb_url" {
  value = "http://${module.alb.alb_dns_name}"
}

output "ecr_web_url" {
  value = module.ecr.web_repo_url
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

output "redis_endpoint" {
  value = module.elasticache.primary_endpoint
}

output "s3_bucket" {
  value = module.s3.bucket_name
}

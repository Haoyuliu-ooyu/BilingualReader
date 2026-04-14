output "cloudfront_domain" { value = aws_cloudfront_distribution.frontend.domain_name }
output "cloudfront_distribution_id" { value = aws_cloudfront_distribution.frontend.id }
output "frontend_bucket_name" { value = aws_s3_bucket.frontend.id }
output "custom_domain" { value = var.custom_domain }

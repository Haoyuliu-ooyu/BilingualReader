output "web_repo_url" { value = aws_ecr_repository.web.repository_url }
output "gateway_repo_url" { value = aws_ecr_repository.gateway.repository_url }
output "worker_repo_url" { value = aws_ecr_repository.worker.repository_url }

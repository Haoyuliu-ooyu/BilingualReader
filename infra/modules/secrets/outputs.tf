output "jwt_secret_arn" { value = aws_secretsmanager_secret.jwt.arn }
output "encryption_key_arn" { value = aws_secretsmanager_secret.encryption_key.arn }
output "all_secret_arns" {
  value = [
    aws_secretsmanager_secret.jwt.arn,
    aws_secretsmanager_secret.encryption_key.arn,
  ]
}

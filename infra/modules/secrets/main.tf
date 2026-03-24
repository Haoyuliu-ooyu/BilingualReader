# Secret placeholders — actual values are set via AWS CLI or console, never in Terraform
resource "aws_secretsmanager_secret" "jwt" {
  name = "${var.project_name}/${var.environment}/jwt-secret"
  tags = { Name = "${var.project_name}-${var.environment}-jwt-secret" }
}

resource "aws_secretsmanager_secret" "encryption_key" {
  name = "${var.project_name}/${var.environment}/llm-encryption-key"
  tags = { Name = "${var.project_name}-${var.environment}-llm-encryption-key" }
}

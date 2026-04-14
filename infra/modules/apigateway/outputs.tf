output "api_url" {
  value       = aws_apigatewayv2_api.main.api_endpoint
  description = "Public HTTPS URL for the API (use as VITE_API_URL in frontend build)"
}

output "service_discovery_arn" {
  value = aws_service_discovery_service.gateway.arn
}

output "alb_dns_name" { value = aws_lb.main.dns_name }
output "web_tg_arn" { value = aws_lb_target_group.web.arn }
output "gateway_tg_arn" { value = aws_lb_target_group.gateway.arn }
output "http_listener_arn" { value = aws_lb_listener.http.arn }

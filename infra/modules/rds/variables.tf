variable "project_name" { type = string }
variable "environment" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "security_group_id" { type = string }
variable "db_name" { type = string }
variable "db_username" { type = string, sensitive = true }
variable "db_password" { type = string, sensitive = true }
variable "instance_class" { type = string, default = "db.t4g.micro" }

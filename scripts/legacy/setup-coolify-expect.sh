#!/usr/bin/expect -f

set timeout 30
set password "@Lex16081974"
set host "212.85.19.50"
set user "root"

spawn ssh -o StrictHostKeyChecking=no $user@$host
expect "password:"
send "$password\r"
expect "#"

# Verificar se Coolify está rodando
send "docker ps | grep coolify\r"
expect "#"

# Verificar logs do Coolify
send "docker logs coolify --tail 20 2>&1 | head -20\r"
expect "#"

# Verificar configuração de proxy do Coolify
send "docker exec coolify cat /var/www/html/.env 2>/dev/null | grep -E '(URL|DOMAIN)' | head -5\r"
expect "#"

send "exit\r"
expect eof

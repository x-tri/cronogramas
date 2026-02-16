#!/usr/bin/expect -f

set timeout 30
set password "@Lex16081974"
set host "212.85.19.50"
set user "root"

spawn ssh -o StrictHostKeyChecking=no $user@$host
expect "password:"
send "$password\r"
expect "#"

# Verificar sites-enabled
send "ls -la /etc/nginx/sites-enabled/\r"
expect "#"

# Verificar a configuração
send "cat /etc/nginx/sites-available/horariodeestudos.com\r"
expect "#"

# Verificar se existe default
send "ls /etc/nginx/sites-enabled/default 2>/dev/null && rm /etc/nginx/sites-enabled/default\r"
expect "#"

# Testar e reiniciar
send "nginx -t && systemctl restart nginx\r"
expect "#"

# Testar localmente
send "curl -s http://localhost | head -5\r"
expect "#"

send "exit\r"
expect eof

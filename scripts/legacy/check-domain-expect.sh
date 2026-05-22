#!/usr/bin/expect -f

set timeout 30
set password "@Lex16081974"
set host "212.85.19.50"
set user "root"

spawn ssh -o StrictHostKeyChecking=no $user@$host
expect "password:"
send "$password\r"
expect "#"

# Verificar configuração do Nginx
send "grep -r horariodeestudos /etc/nginx/\r"
expect "#"

# Verificar hosts
send "cat /etc/hosts | grep horario\r"
expect "#"

# Testar com Host header correto
send "curl -s -H 'Host: horariodeestudos.com' http://localhost | head -5\r"
expect "#"

# Verificar se tem algum redirect
send "curl -I -H 'Host: horariodeestudos.com' http://localhost 2>&1 | head -15\r"
expect "#"

send "exit\r"
expect eof

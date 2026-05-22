#!/usr/bin/expect -f

set timeout 120
set password "@Lex16081974"
set host "212.85.19.50"
set user "root"

spawn ssh -o StrictHostKeyChecking=no $user@$host
expect "password:"
send "$password\r"
expect "#"

send "cd /opt/xtri-cronogramas\r"
expect "#"

# Verificar o docker-compose
send "cat docker-compose.yml\r"
expect "#"

# Fazer o build e subir
send "docker compose down 2>/dev/null; docker compose up -d --build 2>&1\r"
expect "#"

# Verificar status
send "docker ps | grep xtri-cronogramas\r"
expect "#"

send "exit\r"
expect eof

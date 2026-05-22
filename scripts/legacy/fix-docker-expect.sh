#!/usr/bin/expect -f

set timeout 60
set password "@Lex16081974"
set host "212.85.19.50"
set user "root"

spawn ssh -o StrictHostKeyChecking=no $user@$host
expect "password:"
send "$password\r"
expect "#"

# Atualizar Docker
send "curl -fsSL https://get.docker.com | sh\r"
expect "#"

# Verificar versão
send "docker --version\r"
expect "#"

# Ir para o diretório e fazer deploy
send "cd /opt/xtri-cronogramas\r"
expect "#"

# Build e run
send "docker compose down 2>/dev/null || true\r"
expect "#"

send "docker compose up -d --build\r"
expect "#"

send "docker ps\r"
expect "#"

send "exit\r"
expect eof

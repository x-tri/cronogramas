#!/usr/bin/expect -f

set timeout 30
set password "@Lex16081974"
set host "212.85.19.50"
set user "root"

spawn ssh -o StrictHostKeyChecking=no $user@$host
expect "password:"
send "$password\r"
expect "#"

send "cd /opt/xtri-cronogramas && docker ps\r"
expect "#"

send "docker compose logs --tail 20\r"
expect "#"

send "exit\r"
expect eof

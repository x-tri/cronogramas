#!/usr/bin/expect -f

set timeout 30
set password "@Lex16081974"
set host "212.85.19.50"
set user "root"
set remote_dir "/opt/xtri-cronogramas"

spawn ssh -o StrictHostKeyChecking=no $user@$host "mkdir -p $remote_dir"
expect "password:"
send "$password\r"
expect eof

spawn scp -r dist docker-compose.yml Dockerfile nginx.conf deploy.sh $user@$host:$remote_dir/
expect "password:"
send "$password\r"
expect eof

spawn ssh -o StrictHostKeyChecking=no $user@$host
expect "password:"
send "$password\r"
expect "#"
send "cd $remote_dir && chmod +x deploy.sh && ./deploy.sh\r"
expect "#"
send "exit\r"
expect eof

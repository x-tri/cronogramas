#!/usr/bin/expect -f

set timeout 30
set password "@Lex16081974"
set host "212.85.19.50"
set user "root"

spawn ssh -o StrictHostKeyChecking=no $user@$host
expect "password:"
send "$password\r"
expect "#"

# Criar configuração do Nginx
send "cat > /etc/nginx/sites-available/horariodeestudos.com << 'EOF'
server {
    listen 80;
    server_name horariodeestudos.com www.horariodeestudos.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF\r"
expect "#"

# Ativar site
send "ln -sf /etc/nginx/sites-available/horariodeestudos.com /etc/nginx/sites-enabled/ 2>/dev/null || true\r"
expect "#"

# Testar configuração
send "nginx -t\r"
expect "#"

# Reiniciar Nginx
send "systemctl reload nginx\r"
expect "#"

# Verificar status
send "systemctl status nginx --no-pager | head -10\r"
expect "#"

send "exit\r"
expect eof

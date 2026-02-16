#!/bin/bash

# Script de configuração inicial do servidor Hostinger
# Este script deve ser executado UMA VEZ no servidor para configurar o acesso SSH

set -e

echo "🔧 Configurando servidor Hostinger para deploy automático..."

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Chave SSH pública fornecida
SSH_KEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFdan2Tjyci7Q/k3RPcVtB8oTOJGawxLQ/p3S4Fh93sr xtri@mentoriaenem.com"

# 1. Instalar Docker e Docker Compose
echo -e "${BLUE}📦 Instalando Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    usermod -aG docker root
    echo -e "${GREEN}✅ Docker instalado${NC}"
else
    echo -e "${GREEN}✅ Docker já instalado${NC}"
fi

# Instalar Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${BLUE}📦 Instalando Docker Compose...${NC}"
    curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✅ Docker Compose instalado${NC}"
fi

# 2. Configurar chave SSH
echo -e "${BLUE}🔑 Configurando chave SSH...${NC}"
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Adicionar chave pública ao authorized_keys
if ! grep -q "$SSH_KEY" ~/.ssh/authorized_keys 2>/dev/null; then
    echo "$SSH_KEY" >> ~/.ssh/authorized_keys
    chmod 600 ~/.ssh/authorized_keys
    echo -e "${GREEN}✅ Chave SSH adicionada${NC}"
else
    echo -e "${GREEN}✅ Chave SSH já configurada${NC}"
fi

# 3. Configurar diretório da aplicação
echo -e "${BLUE}📁 Criando diretório da aplicação...${NC}"
mkdir -p /opt/xtri-cronogramas
chmod 755 /opt/xtri-cronogramas

# 4. Configurar firewall (opcional, mas recomendado)
echo -e "${BLUE}🛡️ Configurando firewall...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 3000/tcp
    ufw --force enable
    echo -e "${GREEN}✅ Firewall configurado${NC}"
fi

# 5. Verificar se o Nginx está instalado
echo -e "${BLUE}🌐 Verificando Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    apt update
    apt install -y nginx
    echo -e "${GREEN}✅ Nginx instalado${NC}"
else
    echo -e "${GREEN}✅ Nginx já instalado${NC}"
fi

# 6. Criar configuração do Nginx
echo -e "${BLUE}⚙️ Configurando Nginx...${NC}"
cat > /etc/nginx/sites-available/horariodeestudos.com << 'EOF'
server {
    listen 80;
    server_name horariodeestudos.com www.horariodeestudos.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Ativar site
ln -sf /etc/nginx/sites-available/horariodeestudos.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Testar configuração do Nginx
nginx -t && systemctl restart nginx

echo -e "${GREEN}✅ Nginx configurado${NC}"

# 7. Resumo
echo ""
echo -e "${GREEN}🎉 Configuração concluída!${NC}"
echo ""
echo "📋 Resumo:"
echo "  • Docker: $(docker --version)"
echo "  • Docker Compose: $(docker-compose --version)"
echo "  • Nginx: $(nginx -v 2>&1 | head -1)"
echo "  • Diretório: /opt/xtri-cronogramas"
echo "  • Acesso SSH: Configurado com chave ed25519"
echo ""
echo -e "${BLUE}🚀 Próximo passo:${NC}"
echo "  Execute o workflow do GitHub Actions ou faça deploy manual com:"
echo "  ./deploy.sh"
echo ""

#!/bin/bash

# Script completo de deploy para Hostinger
# Este script pode ser executado do seu Mac

set -e

echo "🚀 Deploy XTRI Cronogramas para Hostinger"
echo "=========================================="

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configurações
HOST="212.85.19.50"
USER="root"
REMOTE_DIR="/opt/xtri-cronogramas"

echo ""
echo -e "${BLUE}📋 Verificando pré-requisitos...${NC}"

# Verificar se temos o build
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}⚠️  Pasta dist não encontrada. Fazendo build...${NC}"
    npm run build
fi

echo -e "${GREEN}✅ Build encontrado${NC}"

# Testar conexão SSH
echo ""
echo -e "${BLUE}🔌 Testando conexão SSH...${NC}"
echo "Você precisará digitar a senha do servidor (root@212.85.19.50)"
echo ""

# Criar diretório remoto e enviar arquivos via SCP (vai pedir senha)
echo -e "${BLUE}📦 Enviando arquivos para o servidor...${NC}"
echo "Digite a senha quando solicitado:"
echo ""

# Criar diretório no servidor
ssh ${USER}@${HOST} "mkdir -p ${REMOTE_DIR}" || {
    echo -e "${RED}❌ Erro ao conectar. Verifique se a senha está correta.${NC}"
    exit 1
}

# Enviar arquivos necessários
scp -r dist docker-compose.yml Dockerfile nginx.conf deploy.sh ${USER}@${HOST}:${REMOTE_DIR}/

# Executar deploy no servidor
echo ""
echo -e "${BLUE}🔨 Executando deploy no servidor...${NC}"
ssh ${USER}@${HOST} << EOF
cd ${REMOTE_DIR}

# Instalar Docker se não existir
if ! command -v docker &> /dev/null; then
    echo "Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

# Instalar Docker Compose se não existir
if ! command -v docker-compose &> /dev/null; then
    echo "Instalando Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-\$(uname -s)-\$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Executar deploy
chmod +x deploy.sh
./deploy.sh

# Configurar Nginx
if command -v nginx &> /dev/null; then
    echo "Configurando Nginx..."
    
    # Criar configuração
    cat > /etc/nginx/sites-available/horariodeestudos.com << 'NGINX'
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
NGINX
    
    # Ativar site
    ln -sf /etc/nginx/sites-available/horariodeestudos.com /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
    
    # Testar e reiniciar
    nginx -t && systemctl restart nginx
fi

echo "✅ Deploy concluído!"
EOF

echo ""
echo -e "${GREEN}🎉 Deploy concluído com sucesso!${NC}"
echo ""
echo -e "🌐 Sua aplicação está disponível em:"
echo -e "   ${BLUE}http://horariodeestudos.com${NC}"
echo -e "   ${BLUE}http://212.85.19.50${NC}"
echo ""
echo -e "📊 Para verificar o status:"
echo -e "   ssh root@212.85.19.50 'docker ps'"
echo ""

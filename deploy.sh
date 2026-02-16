#!/bin/bash

# Script de deploy para Hostinger
# XTRI Cronogramas - horariodeestudos.com

set -e

echo "🚀 Iniciando deploy do XTRI Cronogramas..."

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker não encontrado. Instalando...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

# Verificar se Docker Compose está instalado
if ! command -v docker-compose &> /dev/null; then
    echo -e "${BLUE}📦 Instalando Docker Compose...${NC}"
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Parar containers existentes
echo -e "${BLUE}🛑 Parando containers existentes...${NC}"
docker-compose down 2>/dev/null || true

# Remover imagens antigas
echo -e "${BLUE}🧹 Limpando imagens antigas...${NC}"
docker rmi xtri-cronogramas_xtri-cronogramas:latest 2>/dev/null || true

# Build da aplicação
echo -e "${BLUE}🔨 Fazendo build da aplicação...${NC}"
docker-compose build --no-cache

# Iniciar containers
echo -e "${BLUE}▶️  Iniciando containers...${NC}"
docker-compose up -d

# Verificar status
sleep 5
if docker ps | grep -q xtri-cronogramas; then
    echo -e "${GREEN}✅ Deploy concluído com sucesso!${NC}"
    echo -e "${GREEN}🌐 Aplicação disponível em: http://horariodeestudos.com${NC}"
    echo -e "${BLUE}📊 Container status:${NC}"
    docker ps --filter "name=xtri-cronogramas" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
else
    echo -e "${RED}❌ Erro ao iniciar o container${NC}"
    docker-compose logs
    exit 1
fi

#!/bin/bash

echo "🚀 Iniciando XTRI Cronogramas - Modo Desenvolvimento"
echo "======================================================"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erro: package.json não encontrado${NC}"
    echo "Execute este script do diretório do projeto:"
    echo "  cd\"/Volumes/1T/backup/apps/Horários de estudo 1.0/xtri-cronogramas\""
    exit 1
fi

# Limpar cache do Vite se existir
echo -e "${YELLOW}🧹 Limpando cache...${NC}"
rm -rf node_modules/.vite 2>/dev/null

# Verificar se node_modules existe
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 node_modules não encontrado. Instalando dependências...${NC}"
    npm install
fi

# Verificar se a porta 5173 está ocupada
echo -e "${YELLOW}🔍 Verificando porta 5173...${NC}"
PORT_PID=$(lsof -t -i :5173 2>/dev/null)
if [ ! -z "$PORT_PID" ]; then
    echo -e "${YELLOW}⚠️  Porta 5173 ocupada pelo processo $PORT_PID. Matando...${NC}"
    kill -9 $PORT_PID 2>/dev/null
    sleep 1
fi

# Rodar o servidor
echo -e "${GREEN}✅ Iniciando servidor Vite...${NC}"
echo -e "${GREEN}🌐 Acesse: http://localhost:5173${NC}"
echo ""
echo "Comandos úteis:"
echo "  - Pressione 'h' + Enter para ajuda"
echo "  - Pressione 'o' + Enter para abrir navegador"
echo "  - Pressione 'q' + Enter para sair"
echo "======================================================"

npm run dev

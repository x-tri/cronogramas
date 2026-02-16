# Guia de Deploy - XTRI Cronogramas

## 📋 Informações do Servidor

- **Servidor**: Hostinger VPS
- **IP**: 212.85.19.50
- **Domínio**: horariodeestudos.com
- **Container**: Docker

## 🔧 Pré-requisitos no Servidor

### 1. Acessar o servidor via SSH

```bash
ssh root@212.85.19.50
```

### 2. Instalar Docker e Docker Compose (se não estiverem instalados)

```bash
# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER
newgrp docker
```

## 🚀 Deploy da Aplicação

### Opção 1: Deploy Automático (Recomendado)

1. **Copiar os arquivos para o servidor:**

```bash
# Do seu computador local, na pasta do projeto
scp -r . root@212.85.19.50:/opt/xtri-cronogramas
```

2. **No servidor, executar o script de deploy:**

```bash
ssh root@212.85.19.50
cd /opt/xtri-cronogramas
chmod +x deploy.sh
./deploy.sh
```

### Opção 2: Deploy Manual

1. **Copiar os arquivos:**

```bash
scp Dockerfile docker-compose.yml nginx.conf root@212.85.19.50:/opt/xtri-cronogramas/
```

2. **Fazer build e iniciar:**

```bash
ssh root@212.85.19.50
cd /opt/xtri-cronogramas
docker-compose up -d --build
```

## 🔗 Configurar Nginx Reverso (Hostinger)

Como o container roda na porta 3000, precisamos configurar o Nginx do host para fazer proxy:

### 1. Criar configuração do Nginx no host

```bash
sudo nano /etc/nginx/sites-available/horariodeestudos.com
```

### 2. Adicionar configuração:

```nginx
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
```

### 3. Ativar site:

```bash
sudo ln -s /etc/nginx/sites-available/horariodeestudos.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Configurar SSL (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d horariodeestudos.com -d www.horariodeestudos.com
```

## 📊 Comandos Úteis

### Ver logs
```bash
cd /opt/xtri-cronogramas
docker-compose logs -f
```

### Reiniciar aplicação
```bash
cd /opt/xtri-cronogramas
docker-compose restart
```

### Parar aplicação
```bash
cd /opt/xtri-cronogramas
docker-compose down
```

### Atualizar aplicação (após git pull)
```bash
cd /opt/xtri-cronogramas
docker-compose down
docker-compose up -d --build
```

## 🔍 Verificação

Após o deploy, verifique:

1. **Container rodando:**
```bash
docker ps
```

2. **Aplicação respondendo:**
```bash
curl http://localhost:3000
```

3. **Acesso externo:**
Abra http://horariodeestudos.com no navegador

## 🛠️ Troubleshooting

### Problema: Porta 3000 já em uso
```bash
# Verificar processo usando a porta
sudo lsof -i :3000

# Matar processo se necessário
sudo kill -9 <PID>
```

### Problema: Permissão negada no Docker
```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Problema: Nginx não redireciona
```bash
# Verificar configuração
sudo nginx -t

# Verificar se o site está habilitado
ls -la /etc/nginx/sites-enabled/

# Restart do Nginx
sudo systemctl restart nginx
```

## 📁 Estrutura de Arquivos no Servidor

```
/opt/xtri-cronogramas/
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
├── deploy.sh
└── src/
    └── ...
```

## 🔄 CI/CD (Opcional)

Para deploy automático via GitHub Actions, crie `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Hostinger

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to Hostinger
      uses: appleboy/ssh-action@master
      with:
        host: 212.85.19.50
        username: root
        password: ${{ secrets.HOSTINGER_PASSWORD }}
        script: |
          cd /opt/xtri-cronogramas
          git pull
          ./deploy.sh
```

---

**Data do deploy:** $(date)
**Versão:** 2.0

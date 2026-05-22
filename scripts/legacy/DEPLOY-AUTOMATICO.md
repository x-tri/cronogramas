# Deploy Automático - XTRI Cronogramas

Este guia explica como configurar o deploy automático para o servidor Hostinger (212.85.19.50).

## 🎯 Visão Geral

Existem **duas formas** de fazer deploy:

1. **GitHub Actions** (Recomendado) - Deploy automático a cada push
2. **Script Local** - Deploy manual com um comando

---

## Opção 1: GitHub Actions (Automático) 🔄

### Pré-requisitos

1. O código deve estar em um repositório GitHub
2. Acesso ao painel do GitHub para configurar secrets

### Configuração

#### Passo 1: Gerar a Chave SSH Privada

A chave pública já foi fornecida:
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFdan2Tjyci7Q/k3RPcVtB8oTOJGawxLQ/p3S4Fh93sr xtri@mentoriaenem.com
```

Você precisa da **chave privada correspondente** (o conteúdo do arquivo `id_ed25519`).

Se não tiver a chave privada, gere um novo par:

```bash
# Gerar novo par de chaves
ssh-keygen -t ed25519 -C "xtri@mentoriaenem.com" -f ~/.ssh/xtri_hostinger

# Ver chave pública (adicionar ao servidor)
cat ~/.ssh/xtri_hostinger.pub

# Ver chave privada (adicionar ao GitHub)
cat ~/.ssh/xtri_hostinger
```

#### Passo 2: Configurar o Servidor Hostinger (Executar UMA VEZ)

Conecte-se ao servidor e execute o script de setup:

```bash
# Conectar ao servidor
ssh root@212.85.19.50

# Criar arquivo de setup
cat > /tmp/setup.sh << 'SETUP'
#!/bin/bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFdan2Tjyci7Q/k3RPcVtB8oTOJGawxLQ/p3S4Fh93sr xtri@mentoriaenem.com" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
mkdir -p /opt/xtri-cronogramas
echo "✅ Setup concluído"
SETUP

chmod +x /tmp/setup.sh
/tmp/setup.sh
```

Ou, se preferir, execute o script completo que criamos:

```bash
# No seu computador local, envie o script
scp setup-hostinger.sh root@212.85.19.50:/tmp/

# No servidor, execute
ssh root@212.85.19.50 "chmod +x /tmp/setup-hostinger.sh && /tmp/setup-hostinger.sh"
```

#### Passo 3: Configurar Secrets no GitHub

1. Acesse seu repositório no GitHub
2. Vá em **Settings** → **Secrets and variables** → **Actions**
3. Clique em **New repository secret**
4. Adicione os seguintes secrets:

| Nome | Valor |
|------|-------|
| `HOSTINGER_SSH_KEY` | Cole aqui o conteúdo da chave privada (id_ed25519) |

A chave privada deve ter este formato:
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACBXWp9k48nIu0P5N0T3FbQfKEziRmsMS0P6d0uBYfd7KwAAAFgZvWwZGb1s
...
-----END OPENSSH PRIVATE KEY-----
```

#### Passo 4: Push para o GitHub

```bash
git add .
git commit -m "Configura deploy automático para Hostinger"
git push origin main
```

O deploy acontecerá automaticamente! 🎉

---

## Opção 2: Script Local (Manual) 💻

Se preferir não usar GitHub Actions, use o script local:

### Pré-requisitos

1. Chave SSH configurada no seu computador
2. Acesso SSH ao servidor configurado

### Configuração

#### Passo 1: Configurar acesso SSH sem senha

```bash
# Gerar chave SSH (se ainda não tiver)
ssh-keygen -t ed25519 -C "seu-email@exemplo.com"

# Copiar chave pública para o servidor
ssh-copy-id root@212.85.19.50
```

Ou, adicione manualmente a chave pública fornecida ao servidor:

```bash
ssh root@212.85.19.50 "echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFdan2Tjyci7Q/k3RPcVtB8oTOJGawxLQ/p3S4Fh93sr xtri@mentoriaenem.com' >> ~/.ssh/authorized_keys"
```

#### Passo 2: Criar script de deploy local

Crie o arquivo `deploy-local.sh`:

```bash
#!/bin/bash

# Build
npm run build

# Enviar arquivos
rsync -avz --delete dist/ root@212.85.19.50:/opt/xtri-cronogramas/dist/
rsync -avz docker-compose.yml Dockerfile nginx.conf deploy.sh root@212.85.19.50:/opt/xtri-cronogramas/

# Executar deploy no servidor
ssh root@212.85.19.50 "cd /opt/xtri-cronogramas && chmod +x deploy.sh && ./deploy.sh"

echo "✅ Deploy concluído!"
echo "🌐 Acesse: https://horariodeestudos.com"
```

#### Passo 3: Executar deploy

```bash
chmod +x deploy-local.sh
./deploy-local.sh
```

---

## 🔍 Verificação

Após o deploy, verifique:

```bash
# Verificar se o container está rodando
ssh root@212.85.19.50 "docker ps | grep xtri"

# Ver logs
ssh root@212.85.19.50 "cd /opt/xtri-cronogramas && docker-compose logs -f"

# Testar aplicação
curl https://horariodeestudos.com
```

---

## 🛠️ Troubleshooting

### Erro: "Permission denied (publickey)"

A chave SSH não está configurada corretamente. Verifique:

```bash
# No servidor
ssh root@212.85.19.50
cat ~/.ssh/authorized_keys
# Deve conter a chave pública
```

### Erro: "Cannot connect to Docker daemon"

```bash
# No servidor
sudo systemctl start docker
sudo usermod -aG docker root
newgrp docker
```

### Erro: "Port 3000 already in use"

```bash
# No servidor
sudo lsof -i :3000
sudo kill -9 <PID>
# Ou
sudo systemctl stop apache2  # se houver Apache rodando
```

---

## 📝 Checklist de Deploy

- [ ] Chave SSH configurada no servidor
- [ ] Docker e Docker Compose instalados
- [ ] Nginx configurado como reverse proxy
- [ ] DNS apontando para 212.85.19.50
- [ ] SSL/Let's Encrypt configurado (opcional)
- [ ] Secrets configuradas no GitHub (se usar GitHub Actions)
- [ ] Primeiro deploy testado com sucesso

---

## 📞 Suporte

**API Key da Hostinger:** `hsJMWhw1L6wnoPDPof4MGIoTV7FHXch8YeAJ801r328dd702`

**Servidor:** 212.85.19.50
**Domínio:** horariodeestudos.com

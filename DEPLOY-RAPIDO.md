# Deploy Rápido para Hostinger

## Método 1: Script Automático (Recomendado)

Execute este único comando no seu Mac:

```bash
./deploy-to-hostinger.sh
```

**O que ele faz:**
1. Faz build da aplicação
2. Conecta no servidor via SSH (vai pedir a senha)
3. Envia os arquivos
4. Instala Docker e Docker Compose (se necessário)
5. Faz o deploy
6. Configura o Nginx

**Vai pedir:** A senha do root do servidor (solicite na Hostinger se não tiver)

---

## Método 2: Passo a Passo Manual

### Passo 1: Gerar chave SSH (se quiser evitar digitar senha)

```bash
# Gerar chave SSH
ssh-keygen -t ed25519 -C "xtri@mentoriaenem.com" -f ~/.ssh/xtri_hostinger

# Ver a chave pública gerada
cat ~/.ssh/xtri_hostinger.pub
```

### Passo 2: Adicionar chave ao servidor

Conecte-se ao servidor e adicione a chave:

```bash
ssh root@212.85.19.50

# No servidor, execute:
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "sua-chave-publica-aqui" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
exit
```

Substitua `"sua-chave-publica-aqui"` pelo conteúdo que apareceu no `cat ~/.ssh/xtri_hostinger.pub`

### Passo 3: Fazer deploy

Depois de configurar a chave SSH:

```bash
# Build
npm run build

# Enviar arquivos
scp -r dist docker-compose.yml Dockerfile nginx.conf deploy.sh root@212.85.19.50:/opt/xtri-cronogramas/

# Executar deploy no servidor
ssh root@212.85.19.50 "cd /opt/xtri-cronogramas && chmod +x deploy.sh && ./deploy.sh"
```

---

## Método 3: Comandos Um a Um

Se preferir executar comando por comando:

```bash
# 1. Build
npm run build

# 2. Criar diretório no servidor
ssh root@212.85.19.50 "mkdir -p /opt/xtri-cronogramas"

# 3. Enviar arquivos (vai pedir senha)
scp -r dist docker-compose.yml Dockerfile nginx.conf deploy.sh root@212.85.19.50:/opt/xtri-cronogramas/

# 4. Executar deploy (vai pedir senha)
ssh root@212.85.19.50 "cd /opt/xtri-cronogramas && ./deploy.sh"
```

---

## 🔑 Obtendo a Senha do Servidor

Se não tiver a senha SSH do root:

1. **Acesse o painel da Hostinger:** https://hpanel.hostinger.com
2. **Use a API Key fornecida:** `hsJMWhw1L6wnoPDPof4MGIoTV7FHXch8YeAJ801r328dd702`
3. **Vá em:** VPS → Gerenciar → Console SSH ou Redefinir Senha Root

---

## ✅ Verificação

Após o deploy, verifique:

```bash
# Verificar se está rodando
ssh root@212.85.19.50 "docker ps"

# Ver logs
ssh root@212.85.19.50 "cd /opt/xtri-cronogramas && docker-compose logs"

# Testar no navegador
curl http://212.85.19.50:3000
```

---

## 🆘 Problemas Comuns

### "Permission denied (publickey,password)"
A senha está incorreta ou o acesso por senha está desabilitado. Use o console da Hostinger para redefinir.

### "No identities found"
Gere uma chave SSH primeiro:
```bash
ssh-keygen -t ed25519 -C "xtri@mentoriaenem.com"
```

### "Connection refused"
O servidor pode estar com firewall bloqueando porta 22. Verifique no painel da Hostinger.

---

## 📞 Dados do Servidor

- **IP:** 212.85.19.50
- **Usuário:** root
- **Domínio:** horariodeestudos.com
- **Porta SSH:** 22
- **API Key:** hsJMWhw1L6wnoPDPof4MGIoTV7FHXch8YeAJ801r328dd702

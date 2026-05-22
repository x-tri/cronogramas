# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package.json e instalar dependências
COPY package*.json ./
RUN npm install

# Copiar código fonte e fazer build
COPY . .
RUN npm run build

# Production stage com Nginx
FROM nginx:alpine

# Copiar o build do React para o diretório do Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuração do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expor porta 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

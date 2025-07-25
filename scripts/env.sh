#!/bin/sh
set -e

echo "[env.sh] DATABASE_URL=$DATABASE_URL"
echo "[env.sh] DATABASE_HOST=$DATABASE_HOST"
echo "[env.sh] DATABASE_PORT=$DATABASE_PORT"

# Extrai host e porta do DATABASE_URL se não estiverem definidos
if [ -n "$DATABASE_URL" ]; then
  if [ -z "$DATABASE_HOST" ]; then
    export DATABASE_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*://[^@]*@([^:/]+):[0-9]+/.*|\1|')
    echo "[env.sh] (extracted) DATABASE_HOST=$DATABASE_HOST"
  fi
  if [ -z "$DATABASE_PORT" ]; then
    export DATABASE_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*://[^@]*@[^:]+:([0-9]+)/.*|\1|')
    echo "[env.sh] (extracted) DATABASE_PORT=$DATABASE_PORT"
  fi
fi

# Aguarda o banco ficar disponível
until nc -z -v -w30 "$DATABASE_HOST" "$DATABASE_PORT"; do
  echo "Aguardando o banco de dados em $DATABASE_HOST:$DATABASE_PORT..."
  sleep 2
done

# Executa as migrações
# yarn db:setup

# Inicia a aplicação
exec "$@"
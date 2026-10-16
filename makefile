docker-up:
	docker compose -f docker-compose.yml up -d

docker-down:
	docker compose -f docker-compose.yml down

docker-logs:
	docker compose -f docker-compose.yml logs -f

docker-reset:
	docker compose -f docker-compose.yml down -v

db-migrate:
	npx prisma migrate dev

db-studio:
	npx prisma studio

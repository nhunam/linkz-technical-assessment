.PHONY: install up down dev dev-be dev-fe migrate seed lint format

install:
	pnpm install

up:
	docker compose up -d

down:
	docker compose down

dev: up
	pnpm --parallel -r run dev

dev-be:
	pnpm --filter @seat-reservation/be run dev

dev-fe:
	pnpm --filter @seat-reservation/fe run dev

migrate:
	cd apps/be && bun run db:migrate

seed:
	cd apps/be && bun run db:seed

lint:
	pnpm exec biome check .

format:
	pnpm exec biome format --write .

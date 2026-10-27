.DEFAULT_GOAL := help
-include .worktree.env

.PHONY: help new-worktree hooks dev check env-check migrate migrate-staging migrate-prod db-local db-reset seed

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-14s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

new-worktree: ## Link .env.local and assign a free dev port (linked worktrees only)
	node scripts/setup-worktree.mjs

hooks: ## Install the pre-commit secret scan (once per clone; needs `ggshield auth login`)
	pre-commit install

dev: ## Run the dev server on this worktree's port (3000 in the primary checkout)
	NEXT_PUBLIC_APP_URL=http://localhost:$(or $(PORT),3000) npx next dev -p $(or $(PORT),3000)

check: ## Type-check, lint and run unit tests
	npx tsc --noEmit
	npm run lint
	npm test

LOCAL_DB = postgresql://postgres:postgres@127.0.0.1:54322/postgres
LOCAL_STACK = supabase start -x edge-runtime,logflare,vector,imgproxy,studio,postgres-meta,mailpit
PROD_REF = mdnkrzarlaqhozzzozpq
PROD_ENV_FILE ?= .env.production.local

env-check: ## Show which environment .env.local points at (fails if it is production)
	npm run env:check

migrate: ## Apply migrations to the database in .env.local (refuses production)
	set -a && . ./.env.local && set +a && npm run db:migrate

refund-quote: ## Quote a usage-based refund for an account (read-only; pass EMAIL=someone@example.com)
	set -a && . ./.env.local && set +a && npm run refund:quote -- $(EMAIL)

usage-report: ## Report real hosted-AI spend per feature and per application (read-only; pass ARGS="--days=30 --gbp-usd=1.30")
	set -a && . ./.env.local && set +a && npm run usage:report -- $(ARGS)

grant-plan: ## Grant or revoke a plan without Stripe (dry run unless ARGS has --yes): make grant-plan ARGS="you@example.com --kind=lifetime"
	set -a && . ./.env.local && set +a && npm run billing:grant -- $(ARGS)

migrate-staging: ## Apply migrations to staging (reads .env.staging)
	set -a && . ./.env.staging && set +a && npm run db:migrate

migrate-prod: ## Apply migrations to PRODUCTION (reads .env.production.local, asks you to type the project ref)
	@test -f $(PROD_ENV_FILE) || { echo "Create $(PROD_ENV_FILE) with the production DATABASE_DIRECT_URL first."; exit 1; }
	@read -p "PRODUCTION. Type the project ref to continue: " ref && [ "$$ref" = "$(PROD_REF)" ] || { echo "Aborted."; exit 1; }
	set -a && . ./$(PROD_ENV_FILE) && set +a && ALLOW_PRODUCTION=$(PROD_REF) npm run db:migrate

db-local: ## Start the local Supabase stack and apply migrations + platform-setup.sql
	$(LOCAL_STACK)
	DATABASE_DIRECT_URL=$(LOCAL_DB) npm run db:migrate
	docker exec -i supabase_db_jobclock psql -U postgres -v ON_ERROR_STOP=1 < supabase/sql/platform-setup.sql

db-reset: ## Wipe the local database and rebuild it from the migrations
	supabase db reset
	$(MAKE) db-local

seed: ## Create a demo user in the local stack (demo@jobclock.test)
	eval "$$(supabase status -o env)" && NEXT_PUBLIC_SUPABASE_URL=$$API_URL SUPABASE_SERVICE_ROLE_KEY=$$SERVICE_ROLE_KEY npm run db:seed-local

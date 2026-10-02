.DEFAULT_GOAL := help
-include .worktree.env

.PHONY: help new-worktree dev check migrate

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-14s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

new-worktree: ## Link .env.local and assign a free dev port (linked worktrees only)
	node scripts/setup-worktree.mjs

dev: ## Run the dev server on this worktree's port (3000 in the primary checkout)
	NEXT_PUBLIC_APP_URL=http://localhost:$(or $(PORT),3000) npx next dev -p $(or $(PORT),3000)

check: ## Type-check, lint and run unit tests
	npx tsc --noEmit
	npm run lint
	npm test

migrate: ## Apply database migrations (uses DATABASE_URL from .env.local)
	set -a && . ./.env.local && set +a && npm run db:migrate

- @.soul/stack.md
- @.soul/glossary.md
- @.soul/local/dogfood.md

## Этот репозиторий — исходники плагина AgentSoul

Пользователи ставят плагин через `/plugin` из маркетплейса `aibatjardem/agentsoul`. Здесь — его исходники и инструменты сборки.

- Правь только `src/` (контент) и `tools/src/` (сборка, валидатор). `plugins/` и `.claude-plugin/marketplace.json` генерируются: `npm run build`.
- После любой правки: `npm run build && npm test && npm run check`. CI падает, если собранный плагин отстал от исходников.
- Чтобы попробовать плагин вживую: `claude --plugin-dir plugins/agentsoul-ru` в любом тестовом проекте.

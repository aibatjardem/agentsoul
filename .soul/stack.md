## Tech Stack — AgentSoul

> Это **реальный** stack.md проекта AgentSoul (dogfood). Он не является шаблоном. Шаблоны живут в `core/profiles/*/stack.md` и копируются в проекты-консьюмеры через `agentsoul init --profile`.

### Базовое

- **Название:** AgentSoul
- **Описание:** Переиспользуемый soul-kit для Claude Code: soul (всегда в контексте) → skills (гайды и опросники, по требованию) → субагенты (изолированные исполнители). CLI ставит, безопасно обновляет и валидирует.
- **Domain:** developer tooling / меta-программирование Claude Code
- **Тип:** отдельный пакет (не монорепо)

### Runtime

- **Runtime:** Node.js ≥20
- **Язык:** TypeScript 5.6+ (strict, noUncheckedIndexedAccess)
- **Package manager:** npm
- **Monorepo tool:** N/A

### CLI / Backend

- **CLI framework:** commander ^12
- **Module system:** ESM (`type: module`)
- **HTTP framework:** N/A (не веб-сервис)
- **DI:** N/A (простая CLI, DI не нужен)
- **Validation:** ручные type guards на границе (config.json, manifest, frontmatter); YAML — пакет `yaml`
- **Logger:** `console.*` внутри CLI (это tool для разработчика, не прод-сервис)
- **Config:** `.soul/config.json` в целевом проекте (профиль, модели субагентов)

### Данные

- **DB:** N/A (stateless CLI)
- **Файлы:** файловая система — основной "store", операции через `node:fs`
- **Состояние установки:** манифест `.soul/.agentsoul.json` (версия, профиль, sha256 управляемых файлов)
- **Cache:** N/A

### Асинхронность

- **Broker:** N/A
- **Scheduler:** N/A

### Frontend

- N/A (CLI-only)

### API

- **Style:** N/A (CLI-only)
- **Auth:** N/A

### Качество

- **Test runner:** node:test (без зависимостей), тесты в `test/*.test.mjs` против `dist/`
- **E2E:** сценарные тесты init/update/check против temp-директорий и копии `core/`
- **Linter:** ESLint (+ `@typescript-eslint`)
- **Formatter:** Prettier (см. `conventions-guide`)
- **Type checker:** tsc

### Observability

- **Logging:** stdout через `console.log` (CLI)
- **Tracing:** N/A
- **Metrics:** N/A
- **Errors:** throw + process.exit — CLI не имеет error tracking в классическом смысле

### Деплой

- **Hosting:** npm registry (public)
- **Container:** N/A
- **CI/CD:** GitHub Actions: typecheck → build → test → check --source → check (dogfood); publish on tag

### Решения и обоснования

- **Почему commander, а не yargs/meow/clipanion:** минимальные зависимости, хорошая TS-поддержка, стандарт де-факто в Node экосистеме для CLI такого размера.
- **Почему ESM, а не CommonJS:** Node ≥20 полноценно поддерживает ESM, новые проекты не должны наследовать CJS legacy.
- **Почему нет DI:** CLI с 4 командами не нуждается в композитном корне. Источник kit передаётся параметром (`loadKit(coreDir)`), этого достаточно для тестов.
- **Почему хеши, а не копии для трёхстороннего слияния:** решение «обновить / оставить локальное / конфликт» требует только сравнения хешей диска, базы и новой версии. Само слияние текста — работа человека (или `soul-keeper`), CLI его не угадывает.
- **Почему валидатор в CLI, а не bash + Python:** одна среда исполнения (Node), без `pyyaml`, и строгая проверка по манифесту вместо эвристик по суффиксам имён.
- **Почему файлы, а не БД:** AgentSoul — это набор markdown-файлов, который КОПИРУЕТСЯ в проекты. Никакого state за пределами файловой системы нет и не должно быть.

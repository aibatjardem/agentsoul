## Tech Stack — AgentSoul

> Это **реальный** stack.md проекта AgentSoul (dogfood). Он не является шаблоном. Шаблон живёт в `core/soul/stack.md` и копируется в проекты-консьюмеры через `agentsoul init`.

### Базовое

- **Название:** AgentSoul
- **Описание:** Переиспользуемый soul-kit (идентичность + философия + 25+ субагентов) для Claude Code проектов. Устанавливается в любой проект через CLI.
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
- **Validation:** N/A (в первой версии; возможно zod позже для CLI args)
- **Logger:** `console.*` внутри CLI (это tool для разработчика, не прод-сервис)
- **Config:** N/A

### Данные

- **DB:** N/A (stateless CLI)
- **Файлы:** файловая система — основной "store", операции через `node:fs`
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

- **Test runner:** TBD (планируется Vitest или node:test)
- **E2E:** TBD (планируются snapshot-тесты команды init против temp-директорий)
- **Linter:** ESLint (+ `@typescript-eslint`)
- **Formatter:** Prettier (см. `conventions-guide`)
- **Type checker:** tsc

### Observability

- **Logging:** stdout через `console.log` (CLI)
- **Tracing:** N/A
- **Metrics:** N/A
- **Errors:** throw + process.exit — CLI не имеет error tracking в классическом смысле

### Деплой

- **Hosting:** npm registry (public) — планируется
- **Container:** N/A
- **CI/CD:** GitHub Actions — планируется (build + publish on tag)

### Решения и обоснования

- **Почему commander, а не yargs/meow/clipanion:** минимальные зависимости, хорошая TS-поддержка, стандарт де-факто в Node экосистеме для CLI такого размера.
- **Почему ESM, а не CommonJS:** Node ≥20 полноценно поддерживает ESM, новые проекты не должны наследовать CJS legacy.
- **Почему нет DI:** CLI с 3 командами не нуждается в композитном корне. Если вырастет — пересмотрим.
- **Почему файлы, а не БД:** AgentSoul — это набор markdown-файлов, который КОПИРУЕТСЯ в проекты. Никакого state за пределами файловой системы нет и не должно быть.

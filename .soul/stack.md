## Tech Stack — AgentSoul

> Реальный stack.md репозитория AgentSoul. Шаблоны для проектов пользователей — в `src/locales/<l>/profiles/*/stack.md`.

### Базовое

- **Языки:** TypeScript, Bash
- **Название:** AgentSoul
- **Описание:** Плагин Claude Code: душа (хук при старте сессии), skills (справочники, языковые пакеты, опросники) и 19 субагентов. Репозиторий — исходники и инструменты сборки; он же маркетплейс `agentsoul`.
- **Domain:** developer tooling / контент для Claude Code
- **Тип:** один репозиторий, плагины по локалям в `plugins/`

### Runtime

- **Runtime:** Node.js ≥20 (только для инструментов разработки; пользователю плагина Node не нужен)
- **Язык:** TypeScript 5 (strict, noUncheckedIndexedAccess), ESM; хук — bash только со встроенными средствами
- **Package manager:** npm
- **Monorepo tool:** N/A

### Инструменты

- **Сборка:** `tools/src/build.ts` — `src/locales/<l>` + `src/shared` → `plugins/agentsoul-<l>/`, `.claude-plugin/marketplace.json`
- **Валидатор:** `tools/src/validate.ts` — frontmatter, ссылки `{{plugin}}:…`, карта команды, бюджет души, синтаксис bash, паритет локалей
- **Зависимости:** `yaml` (разбор frontmatter)

### Данные

- **DB:** N/A — только файлы в git

### Frontend / API

- N/A

### Качество

- **Test runner:** node:test, `test/*.test.mjs` против `tools/dist/` и собранного плагина
- **Type checker:** tsc
- **Проверка плагина:** `claude plugin validate .` и живой запуск `claude -p --plugin-dir plugins/agentsoul-ru`

### Деплой

- **Распространение:** маркетплейс Claude Code прямо из git (`/plugin marketplace add aibatjardem/agentsoul`); npm не публикуется
- **CI/CD:** GitHub Actions: typecheck → test → check (валидатор + собранный плагин совпадает с исходниками)

### Решения и обоснования

- **Почему плагин, а не npm-установщик:** у новичков может не быть Node.js; плагин ставится и обновляется самим Claude Code, без копирования файлов в каждый проект.
- **Почему собранный плагин коммитится:** маркетплейс читает плагин прямо из git; сборка на стороне пользователя невозможна.
- **Почему хук на bash без утилит:** Claude Code может запускать SessionStart-хуки со сломанным PATH; на Windows bash даёт Git for Windows через `run-hook.cmd`.
- **Почему сжатая душа в хуке:** `additionalContext` ограничен 10 000 символами; полный текст — skill `soul`.

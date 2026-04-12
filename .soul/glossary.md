## Глоссарий — Ubiquitous Language AgentSoul

> Это **реальный** glossary.md проекта AgentSoul (dogfood). Шаблон-placeholder живёт в `core/soul/glossary.md` и копируется в проекты-консьюмеры через `agentsoul init`.

### Bounded Contexts

- **`Core`** — переиспользуемый контент soul-комплекта: markdown-файлы baseline'а, субагенты, валидационный скрипт. Это "данные" AgentSoul, которые копируются в проекты-консьюмеры.
- **`CLI`** — TypeScript-код, который читает `Core` и копирует его в целевой проект. Три команды: `init`, `check`, `update`.
- **`Dogfood`** — сам AgentSoul как проект-консьюмер своего же `Core`. `.soul/` и `.claude/agents/` в корне AgentSoul — это применение AgentSoul к самому себе.

### Context Map

- `CLI` → `Core`: **Customer-Supplier.** CLI читает файлы `Core`, но не меняет их. `Core` — supplier, CLI — customer.
- `Dogfood` → `Core`: **Shared Kernel.** Dogfood — это "зеркало" `Core` для самопотребления. Все правки проходят через `Core`, потом синхронизируются в `Dogfood`.
- `Dogfood` → `CLI`: через `Core`. Dogfood не вызывает CLI напрямую, но пользуется `scripts/check-soul.sh` для валидации.

---

## Термины

### Core

**Контекст:** `Core`
**Тип:** Concept (не Entity)

**Определение** — переиспользуемая "начинка" AgentSoul: `core/soul/*` (baseline markdown), `core/claude-agents/*` (субагенты), `core/scripts/*` (утилиты). То, что копируется в целевой проект при `agentsoul init`.

---

### Baseline (файлы)

**Контекст:** `Core`
**Тип:** Group of files

**Определение** — файлы, которые в целевом проекте попадают в `.soul/` и всегда загружаются в контекст главного агента Claude Code через `CLAUDE.md` @imports. Состав: `identity.md`, `agents.md`, `stack.md`, `glossary.md`, `README.md`.

**Инварианты:**
- Baseline всегда мал (~500 строк), иначе раздувает контекст каждой сессии
- `stack.md` и `glossary.md` — project-specific, заполняются инициализаторами
- Остальные — одинаковые для всех проектов-консьюмеров AgentSoul

---

### Subagent

**Контекст:** `Core`
**Тип:** Entity

**Определение** — специализированный Claude-агент с собственным system prompt'ом, живущий в `core/claude-agents/<name>.md`. Вызывается главным агентом через Agent tool с `subagent_type: "<name>"`. Три рода: **executor** (делает работу), **knowledge-guide** (отвечает на архитектурные вопросы), **initializer** (заполняет baseline-файлы), плюс **meta** (`soul-keeper`).

**Инварианты:**
- Имя файла == `name` в frontmatter (без `.md`)
- Frontmatter содержит `name`, `description`, `tools` — проверяется `check-soul.sh`
- `description` на английском (для семантического матчинга Claude Code)
- Тело на русском (для консистентности с другими файлами AgentSoul)

---

### Initializer

**Контекст:** `Core`
**Тип:** Subagent subtype

**Определение** — особый тип субагента, который **пишет** файлы в `.soul/`. Два варианта: `project-initializer` (заполняет `stack.md`) и `glossary-initializer` (заполняет `glossary.md`). Требуют `Write`/`Edit` tools.

---

### CLI Command

**Контекст:** `CLI`
**Тип:** Entity

**Определение** — TypeScript-функция в `src/commands/<name>.ts`, экспортирующая `run<Name>(options)`. Обёрнута в commander-команду в `src/cli.ts`. Три команды: `init`, `check`, `update`.

---

### Target Project

**Контекст:** `CLI`
**Тип:** Concept

**Определение** — проект-консьюмер AgentSoul. Произвольная директория, куда `agentsoul init` копирует core и создаёт `CLAUDE.md`. CLI взаимодействует с target project только через файловую систему, никаких других каналов нет.

---

### Dogfood

**Контекст:** `Dogfood`
**Тип:** Concept

**Определение** — `.soul/` и `.claude/agents/` в корне самого AgentSoul, которые зеркалят `core/soul/` и `core/claude-agents/` (с двумя исключениями: AgentSoul'овские stack.md и glossary.md не являются шаблонами, а содержат реальные данные проекта). Позволяет AgentSoul работать над собой, используя собственные правила и субагенты.

**Инварианты:**
- `.soul/identity.md` === `core/soul/identity.md`
- `.soul/agents.md` === `core/soul/agents.md`
- `.soul/README.md` === `core/soul/README.md`
- `.claude/agents/*` === `core/claude-agents/*`
- `.soul/stack.md` ≠ `core/soul/stack.md` (первый — реальный, второй — template)
- `.soul/glossary.md` ≠ `core/soul/glossary.md` (первый — этот файл, второй — template)

---

## Конфликты языка (одинаковые слова, разные смыслы)

- **"Агент"** в контексте AgentSoul = **Subagent** (Claude-инстанс с system prompt'ом). Не путать с "AI Agent" в общем смысле.
- **"Core"** в контексте AgentSoul = директория `core/` с переиспользуемым контентом. Не путать с "core domain" из DDD.
- **"Soul"** = **Baseline**. "Soul-комплект" = baseline + субагенты. Не путать с "identity" (это только один из файлов soul'а).

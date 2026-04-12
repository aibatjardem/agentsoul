# AgentSoul

Переиспользуемый soul-kit для Claude Code: идентичность, философия, 25+ специализированных субагентов. Устанавливается в любой проект одной командой.

> AgentSoul — это **душа + команда специалистов**, которую можно подключить к любому Claude Code проекту. Один раз определил принципы, ценности, архитектурные правила — и применяешь их везде, одинаково, без копирования руками.

---

## Что внутри

- **`core/soul/`** — baseline, который всегда в контексте главного агента:
  - `identity.md` — личность, голос, красные линии
  - `agents.md` — индекс всех субагентов + правила вызова + иерархия правил (локальное > глобальное)
  - `stack.md` — технологический стек (заполняется `project-initializer`)
  - `glossary.md` — Ubiquitous Language проекта (заполняется `glossary-initializer`)
  - `README.md` — onboarding для нового члена команды / новой сессии
- **`core/claude-agents/`** — 25 субагентов Claude Code:
  - 2 initializers (`project-initializer`, `glossary-initializer`)
  - 4 knowledge-guides (`architecture-guide`, `conventions-guide`, `infrastructure-guide`, `stack-reference`)
  - 18 executors (ddd/code/persistence/observability/api-architects, специалисты по security, performance, debugging, refactoring, testing, deployment, git, frontend, release, review)
  - 1 meta (`soul-keeper`)
- **`core/scripts/check-soul.sh`** — CI-валидатор консистентности soul-комплекта
- **`src/`** — CLI для установки и обновления (`agentsoul init`, `agentsoul check`, `agentsoul update`)

## Установка в проект

```bash
# локально (из соседнего каталога):
cd /path/to/your/project
npm install -D ../AgentSoul      # или file:../AgentSoul
npx agentsoul init

# в будущем, после публикации в npm:
npm install -D @samiyev/agentsoul
npx agentsoul init
```

`agentsoul init` скопирует:
- `core/soul/*` → `<project>/.soul/*`
- `core/claude-agents/*` → `<project>/.claude/agents/*`
- `core/scripts/check-soul.sh` → `<project>/scripts/check-soul.sh`
- создаст `<project>/CLAUDE.md` (если нет) с подключением baseline-файлов и bootstrap-правилом

По умолчанию **safe**: существующие файлы не перезаписываются. Для перезаписи — флаг `--force`.

## После установки

1. **Перезапусти Claude Code** в целевом проекте — субагенты обнаруживаются при старте сессии.
2. **Запусти `project-initializer`** — он задаст вопросы про стек (runtime, БД, очереди, frontend, etc.) и заполнит `.soul/stack.md`.
3. **Запусти `glossary-initializer`** — он зафиксирует bounded contexts и доменные термины в `.soul/glossary.md`.
4. **Проверь консистентность**: `bash scripts/check-soul.sh` или `npx agentsoul check`.
5. Работай над проектом — агенты в курсе твоего стека и домена.

## Команды CLI

```bash
agentsoul init               # установить в текущий каталог (safe)
agentsoul init -f            # перезаписать существующие файлы
agentsoul init -t <path>     # установить в конкретный каталог
agentsoul check              # запустить валидацию в текущем каталоге
agentsoul update -f          # обновить core-файлы до свежей версии (stack.md/glossary.md не трогаются)
```

## Обновление

```bash
npm update @samiyev/agentsoul
npx agentsoul update -f       # применит свежий core в проект
bash scripts/check-soul.sh    # убедись что всё консистентно
```

Обновление **не трогает** `stack.md`, `glossary.md` и `CLAUDE.md` — это твои project-specific файлы. Обновляются только:
- `.soul/identity.md`, `.soul/agents.md`, `.soul/README.md`
- `.claude/agents/*`
- `scripts/check-soul.sh`

## Философия

Soul-комплект — это **договорённость с собой**: как писать код, как мыслить о архитектуре, как избегать повторения одних и тех же ошибок во всех проектах. AgentSoul превращает эту договорённость в переиспользуемый артефакт, который:

- **Версионируется** — каждый проект знает, на какой версии soul он живёт
- **Обновляется безопасно** — project-specific файлы не трогаются, core эволюционирует отдельно
- **Принудительно консистентен** — валидатор не даст соулу разъехаться
- **Dogfood'ится сам** — репо AgentSoul использует собственное ядро для своего же кода

## Разработка AgentSoul (внутренняя)

```bash
cd AgentSoul
npm install
npm run build                # tsc → dist/
npm run typecheck            # проверка типов без сборки
npm run check                # валидация собственного soul-комплекта
node dist/cli.js init -t /tmp/test-project   # локальный тест CLI
```

AgentSoul сам работает под AgentSoul — его `.soul/` и `.claude/agents/` синхронизированы с `core/` (см. `scripts/sync-dogfood.sh`, если он есть).

## Лицензия

MIT.

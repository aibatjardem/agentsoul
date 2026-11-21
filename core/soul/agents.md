## Skills, субагенты и как с ними работать

Soul-комплект устроен в три слоя — по тому, как Claude Code реально загружает контекст:

| Слой | Где живёт | Как попадает в контекст |
|---|---|---|
| **Soul** | `.soul/identity.md`, `agents.md`, `stack.md`, `glossary.md`, `local/*.md` | Всегда: импортируется в `CLAUDE.md` |
| **Skills** | `.claude/skills/<name>/SKILL.md` | По требованию: ты вызываешь skill, и его текст загружается **в твой контекст**. Субагенты получают нужные skills при старте через поле `skills:` во frontmatter |
| **Субагенты** | `.claude/agents/<name>.md` | Отдельный процесс с **изолированным контекстом**: видит только свой промпт, подгруженные skills и то, что ты передал в вызове. Назад возвращает только итоговый ответ |

Отсюда правило выбора: **знание и диалог с пользователем — skill, самостоятельная работа — субагент.** Субагент не может задать вопрос пользователю и не может вызвать другого субагента.

---

### Приоритет правил (ВАЖНО)

`.soul/local/*.md` > `.soul/*` и skills > глобальные defaults Claude Code и `~/.claude/CLAUDE.md`. Это не спор, это иерархия: чем конкретнее источник, тем он сильнее. Подробно — в `identity.md`, раздел «Иерархия правил».

---

### Прежде чем начать любую нетривиальную задачу

1. **Проверь baseline:**
   - `.soul/stack.md` содержит `TBD` / «ещё не заполнен» → **остановись** и предложи запустить skill `project-initializer`.
   - `.soul/glossary.md` содержит `TBD` → предложи skill `glossary-initializer`.
2. **Загрузи релевантные справочные skills** (таблица ниже). Архитектурная задача → `architecture-guide` и/или `conventions-guide` ДО написания кода. Skills не грузятся сами — вызывай их.
3. **Передавай контекст субагентам явно.** Субагент не видит твоей переписки. Опиши задачу, затронутые файлы, ограничения и релевантные куски `.soul/stack.md` / `.soul/glossary.md` / `.soul/local/`.

---

### Когда субагент НЕ нужен

Работай напрямую, если:

- задача механическая: переименование, форматирование, очевидный bug fix;
- изменение в одном файле и меньше ~50 строк;
- решение очевидно и укладывается в устоявшиеся паттерны проекта;
- исследовательский вопрос («где живёт X?») — Grep/Read напрямую;
- пользователь просит сделать быстро и точечно.

Лишний вызов субагента — потерянное время и токены. Качество вызова важнее количества.

---

### Skills первичной настройки (диалог с пользователем)

| Skill | Что делает |
|---|---|
| `project-initializer` | Опросник по tech stack, пишет `.soul/stack.md`. Спрашивает только про поля `TBD` — часть может быть заполнена профилем |
| `glossary-initializer` | Опросник по Ubiquitous Language, пишет `.soul/glossary.md` |

Запускай в начале проекта или когда стек / домен существенно расширились. Сначала стек, потом язык.

---

### Справочные skills (правила проекта)

Не пишут код — загружают правила в контекст. Baseline намеренно лёгкий; большие правила подгружаются по требованию.

| Skill | Когда загружать |
|---|---|
| `architecture-guide` | Новый модуль, Clean Architecture, Hexagonal, IoC, ACL, базовые классы, фабрики, bounded contexts |
| `conventions-guide` | Перед значимым куском кода или ревью: TS strict, нейминг, Result-паттерн, JSDoc, ESLint ZERO TOLERANCE |
| `infrastructure-guide` | Процессы, очереди, межпроцессная коммуникация, структура монорепо, ACL-домены |
| `stack-reference` | Форма стандартных команд (build/test/lint/dev). Сам стек — в `.soul/stack.md` |

**Обязательные комбинации:**

- Новый use case / агрегат / порт → `architecture-guide` + `conventions-guide`
- Новый процесс / worker / очередь → `infrastructure-guide` + `architecture-guide`
- Реализация домена → `conventions-guide` + `architecture-guide`

---

### Субагенты-исполнители

Колонка «Права»: **RO** — только читает и анализирует (Read, Grep, Glob, Bash), изменения вносишь ты; **RW** — может править файлы. Модель задаётся в `.soul/config.json` (см. ниже).

| Субагент | Права | Когда вызывать |
|---|---|---|
| `ddd-architect` | RO | Bounded Context, Aggregates, Domain Events, ACL, Context Map |
| `domain-expert` | RO | Бизнес-инварианты, Ubiquitous Language, правила консистентности |
| `code-architect` | RO | Системный дизайн, структура модулей, IoC, выбор паттернов |
| `persistence-architect` | RO | Миграции, транзакции, soft delete, event sourcing, schema versioning |
| `observability-architect` | RO | Structured logging, metrics, tracing, SLI/SLO, alerts |
| `api-designer` | RO | API-контракты: endpoints, версионирование, идемпотентность, error shapes, pagination |
| `security-specialist` | RO | Auth, секреты, валидация на границе доверия, уязвимости |
| `performance-optimizer` | RO | Bottlenecks, N+1, memory leaks, профилирование |
| `debugging-specialist` | RO | Баги с неочевидной причиной, root cause analysis |
| `task-planner` | RO | Декомпозиция большой задачи в план |
| `code-reviewer` | RO | Финальная проверка после значимого изменения |
| `frontend-designer` | RW | UI-компоненты, страницы, layout (фреймворк — из `.soul/stack.md`) |
| `frontend-specialist` | RW | Frontend-логика: state, формы, routing — без дизайна |
| `refactoring-expert` | RW | Рефакторинг на несколько файлов / паттернов |
| `testing-specialist` | RW | TDD-стратегия, test design, mocking |
| `deployment-specialist` | RW | CI/CD, Docker, деплой, production-инциденты |
| `git-specialist` | RW | Сложные merge/rebase/conflict, стратегия ветвления |
| `release-manager` | RW | SemVer, changelog, release notes |
| `soul-keeper` | RW | Консистентность самого комплекта: добавить/удалить/переименовать агента или skill, слить `*.agentsoul-new`, перенести правило в `.soul/local/` |

---

### Правила вызова

1. **Качество вызова важнее количества.** Один точный вызов лучше трёх «на всякий случай».
2. **По умолчанию — по одному.** Параллельно вызывай только независимые задачи и только если `.soul/local/` это не запрещает: каждый субагент стартует с нуля и тратит лимит.
3. **Порядок при сложных задачах:** справочные skills → проектирование (`ddd-architect`, `domain-expert`, `code-architect`) → реализация → проверка (`code-reviewer`, `security-specialist`).
4. **Передавай контекст** — промпт без контекста = ответ без ценности.
5. **Не повторяй вызов с тем же промптом** — если ответ не устроил, уточни промпт.
6. **Сомневаешься — спроси пользователя**, нужен ли специалист.

### Модели субагентов

У каждого субагента есть `model` во frontmatter. Значения по умолчанию задаёт AgentSoul, а проект переопределяет их в `.soul/config.json`:

```json
{ "models": { "default": "opus", "agents": { "git-specialist": "sonnet" } } }
```

После правки конфига запусти `npx agentsoul update` — CLI перепишет frontmatter агентов. Руками `model` в `.claude/agents/*.md` не правь: это пометится как drift.

### Примеры

```
"Спроектируй модуль заказов"
 → skills architecture-guide + conventions-guide
 → ddd-architect, затем domain-expert
 → реализация
 → code-reviewer

"Добавь use case к существующему агрегату"
 → skill conventions-guide → реализация → code-reviewer

"Сделай компонент таблицы"
 → прочитай .soul/stack.md → frontend-designer

"Оптимизируй медленный endpoint"
 → performance-optimizer (диагностика) → фикс → code-reviewer

"Переименуй переменную"
 → напрямую, субагент не нужен
```

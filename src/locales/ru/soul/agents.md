## Skills, субагенты и как с ними работать

AgentSoul устроен в три слоя — по тому, как Claude Code реально загружает контекст:

| Слой | Где живёт | Как попадает в контекст |
|---|---|---|
| **Душа** | плагин + `.soul/` проекта | Всегда: сжатая версия приходит хуком при старте сессии, полная — skill `{{plugin}}:soul` |
| **Skills** | плагин | По требованию: ты вызываешь skill, и его текст загружается **в твой контекст**. Субагенты получают нужные skills при старте через поле `skills:` |
| **Субагенты** | плагин | Отдельный процесс с **изолированным контекстом**: видит только свой промпт, подгруженные skills и то, что ты передал в вызове. Назад возвращает только итоговый ответ |

Данные проекта лежат в самом проекте: `.soul/stack.md` (стек и строка «Языки»), `.soul/glossary.md` (термины), `.soul/local/*.md` (правила проекта). Плагин их никогда не перезаписывает.

Правило выбора: **знание и диалог с пользователем — skill, самостоятельная работа — субагент.** Субагент не может задать вопрос пользователю и не может вызвать другого субагента.

---

### Приоритет правил

`.soul/local/*.md` > душа и skills AgentSoul > стандартные настройки Claude Code и `~/.claude/CLAUDE.md`. Чем конкретнее источник, тем он сильнее.

---

### Прежде чем начать любую нетривиальную задачу

1. **Проверь данные проекта.** Нет `.soul/` — предложи `/{{plugin}}:setup`. В `stack.md` есть `TBD` — предложи `/{{plugin}}:project-initializer`. В `glossary.md` есть `TBD` — `/{{plugin}}:glossary-initializer`.
2. **Загрузи языковые пакеты** — `{{plugin}}:lang-` + язык из строки «Языки» (`lang-python`, `lang-typescript`…), если такой skill есть.
3. **Загрузи справочники** по задаче. Архитектурная задача → `{{plugin}}:architecture-guide` и `{{plugin}}:conventions-guide` ДО написания кода.
4. **Передавай контекст субагентам явно.** Опиши задачу, затронутые файлы, ограничения и нужные куски `.soul/`.

---

### Когда субагент НЕ нужен

- механическая правка: переименование, форматирование, очевидный bug fix;
- один файл и меньше ~50 строк;
- решение очевидно и укладывается в паттерны проекта;
- исследовательский вопрос («где живёт X?») — Grep/Read напрямую;
- пользователь просит быстро и точечно.

Лишний вызов — потерянное время и лимит. Качество вызова важнее количества.

---

### Skills — разговор с пользователем

| Skill | Что делает |
|---|---|
| `{{plugin}}:setup` | Настраивает AgentSoul в проекте: языки, профиль стека, термины. Переносит старую установку 0.1/0.2 |
| `{{plugin}}:project-initializer` | Опросник по стеку, пишет `.soul/stack.md`. Начинает с языков |
| `{{plugin}}:glossary-initializer` | Опросник по терминам домена, пишет `.soul/glossary.md` |

### Skills — справочники

| Skill | Когда загружать |
|---|---|
| `{{plugin}}:architecture-guide` | Новый модуль, Clean Architecture, Hexagonal, IoC, ACL, базовые классы, фабрики, bounded contexts |
| `{{plugin}}:conventions-guide` | Перед значимым куском кода или ревью: нейминг, обработка ошибок, тесты, документация |
| `{{plugin}}:infrastructure-guide` | Процессы, очереди, межпроцессная коммуникация, монорепо, ACL-домены |
| `{{plugin}}:stack-reference` | Форма стандартных команд (build/test/lint/dev) |
| `{{plugin}}:soul` | Полный текст души и эта карта — в спорной ситуации |

---

### Субагенты

**RO** — только читают и советуют (Read, Grep, Glob, Bash, Skill), изменения вносишь ты. **RW** — могут править файлы. Все работают на модели текущей сессии.

| Субагент | Права | Когда вызывать |
|---|---|---|
| `{{plugin}}:ddd-architect` | RO | Bounded Context, Aggregates, Domain Events, ACL, Context Map |
| `{{plugin}}:domain-expert` | RO | Бизнес-инварианты, Ubiquitous Language, правила консистентности |
| `{{plugin}}:code-architect` | RO | Системный дизайн, структура модулей, IoC, выбор паттернов |
| `{{plugin}}:persistence-architect` | RO | Миграции, транзакции, soft delete, event sourcing, schema versioning |
| `{{plugin}}:observability-architect` | RO | Structured logging, metrics, tracing, SLI/SLO, alerts |
| `{{plugin}}:api-designer` | RO | API-контракты: endpoints, версионирование, идемпотентность, ошибки, pagination |
| `{{plugin}}:security-specialist` | RO | Auth, секреты, валидация на границе доверия, уязвимости |
| `{{plugin}}:performance-optimizer` | RO | Bottlenecks, N+1, memory leaks, профилирование |
| `{{plugin}}:debugging-specialist` | RO | Баги с неочевидной причиной, root cause analysis |
| `{{plugin}}:task-planner` | RO | Декомпозиция большой задачи в план |
| `{{plugin}}:code-reviewer` | RO | Финальная проверка после значимого изменения |
| `{{plugin}}:frontend-designer` | RW | UI-компоненты, страницы, layout (фреймворк — из `.soul/stack.md`) |
| `{{plugin}}:frontend-specialist` | RW | Frontend-логика: state, формы, routing — без дизайна |
| `{{plugin}}:refactoring-expert` | RW | Рефакторинг на несколько файлов / паттернов |
| `{{plugin}}:testing-specialist` | RW | TDD-стратегия, test design, mocking |
| `{{plugin}}:deployment-specialist` | RW | CI/CD, Docker, деплой, production-инциденты |
| `{{plugin}}:git-specialist` | RW | Сложные merge/rebase/conflict, стратегия ветвления |
| `{{plugin}}:release-manager` | RW | SemVer, changelog, release notes |
| `{{plugin}}:soul-keeper` | RW | Порядок в `.soul/` проекта: стек, словарь и правила совпадают с кодом и друг с другом |

---

### Правила вызова

1. **Качество вызова важнее количества.** Один точный вызов лучше трёх «на всякий случай».
2. **По одному.** Параллельно — только независимые задачи и только если `.soul/local/` это не запрещает: каждый субагент стартует с нуля и тратит лимит.
3. **Порядок при сложных задачах:** справочники → проектирование (`{{plugin}}:ddd-architect`, `{{plugin}}:domain-expert`, `{{plugin}}:code-architect`) → реализация → проверка (`{{plugin}}:code-reviewer`, `{{plugin}}:security-specialist`).
4. **Передавай контекст** — промпт без контекста = ответ без ценности.
5. **Не повторяй вызов с тем же промптом** — уточни промпт.
6. **Сомневаешься — спроси пользователя**, нужен ли специалист.

### Примеры

```
"Спроектируй модуль заказов"
 → skills architecture-guide + conventions-guide + lang-<язык>
 → ddd-architect, затем domain-expert
 → реализация
 → code-reviewer

"Сделай регистрацию в Telegram-боте"
 → прочитай .soul/stack.md (Python, aiogram) → skill lang-python
 → реализация + тесты → code-reviewer

"Оптимизируй медленный endpoint"
 → performance-optimizer (диагностика) → фикс → code-reviewer

"Переименуй переменную"
 → напрямую, субагент не нужен
```

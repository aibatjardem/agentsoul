# AgentSoul

[![CI](https://github.com/aibatjardem/agentsoul/actions/workflows/ci.yml/badge.svg)](https://github.com/aibatjardem/agentsoul/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**Плагин для Claude Code: душа и команда из 19 специалистов.** Один раз задаёшь принципы — и каждый проект работает по ним: Claude знает твой стек и термины, пишет тесты вместе с кодом, держит архитектуру в порядке и зовёт ревьюера.

> Версия 0.3. Сейчас готов русский плагин `agentsoul-ru`. Языковые пакеты (TypeScript, Python, Go, Java, C#) — в работе.

---

## Установка

Нужен только [Claude Code](https://code.claude.com). Node.js и npm не нужны.

Напиши прямо в Claude Code:

```
/plugin install agentsoul-ru --marketplace aibatjardem/agentsoul
```

На Claude Code старше 2.1.275 — двумя командами:

```
/plugin marketplace add aibatjardem/agentsoul
/plugin install agentsoul-ru@agentsoul
```

Потом **перезапусти Claude Code**.

> **Windows:** нужен установленный [Git for Windows](https://git-scm.com/download/win) — плагин загружает душу коротким bash-скриптом. Без него Claude Code работает, но без души.

## Настройка проекта

Открой свой проект в Claude Code и запусти:

```
/agentsoul-ru:setup
```

Claude спросит:

1. новый это проект или уже существующий (во втором случае сначала посмотрит на код);
2. на каких языках проект — можно несколько;
3. взять готовый профиль стека или ответить на вопросы по шагам;
4. главные термины проекта — чтобы в коде и в разговоре вещи назывались одинаково.

В проекте появится папка `.soul/`. **Закоммить её в git** вместе с кодом.

```
.soul/
├─ stack.md        стек: языки, фреймворки, база данных, тесты, деплой
├─ glossary.md     словарь проекта
└─ local/
   └─ rules.md     твои правила — самый сильный слой
```

Эти файлы — твои: плагин их никогда не перезаписывает.

## Как работать

Просто ставь задачи обычными словами. При старте каждой сессии плагин сам рассказывает Claude, кто он, какие у него правила и где лежат файлы проекта. Дальше Claude:

- читает `stack.md` и загружает справочники под задачу;
- уточняет, если что-то неясно — с вариантами, рекомендуемый первым;
- пишет код вместе с тестами;
- отдаёт часть работы специалистам и в конце зовёт ревьюера.

Специалиста можно позвать и вручную: `@agent-agentsoul-ru:code-reviewer`.

### Команда

| Только советуют | Могут править код |
|---|---|
| ddd-architect, domain-expert, code-architect, persistence-architect, api-designer, observability-architect, task-planner, code-reviewer, security-specialist, performance-optimizer, debugging-specialist | frontend-designer, frontend-specialist, refactoring-expert, testing-specialist, deployment-specialist, git-specialist, release-manager, soul-keeper |

Все работают на той же модели, что и твоя сессия.

### Команды

| Команда | Что делает |
|---|---|
| `/agentsoul-ru:setup` | Настроить проект (или перенести старую установку) |
| `/agentsoul-ru:project-initializer` | Обновить стек |
| `/agentsoul-ru:glossary-initializer` | Обновить словарь терминов |
| `/agentsoul-ru:soul` | Полный текст души и карта команды |

## Свои правила

Всё, что в твоём проекте устроено иначе, пиши в `.soul/local/rules.md` обычным языком:

```markdown
- Задачи из TASKS.md делай сам, вопросы — только при блокере
- Специалистов зови по одному
- Тексты интерфейса — только на русском
```

Правила из `.soul/local/` сильнее всего остального: и души AgentSoul, и стандартных настроек Claude Code. Файлов может быть сколько угодно.

## Обновление

Для сторонних маркетплейсов автообновление по умолчанию выключено. Включи его: `/plugin` → **Marketplaces** → **agentsoul** → **Auto-update**.

Вручную:

```
/plugin marketplace update agentsoul
/reload-plugins
```

Обновление меняет только плагин. Папку `.soul/` в проектах оно не трогает.

## Если что-то не так

| Проблема | Что делать |
|---|---|
| Специалист пишет, что `stack.md` не заполнен | `/agentsoul-ru:project-initializer` |
| Claude не видит агентов или skills | Перезапусти Claude Code или `/reload-plugins`; проверь в `/plugin`, что плагин включён |
| Windows: душа не загружается | Установи Git for Windows и перезапусти Claude Code |
| Советует не то | Проверь, что в `stack.md` правда. Не согласен с принципом — добавь своё правило в `.soul/local/` |
| В проекте осталась старая установка (0.1/0.2 через npm) | `/agentsoul-ru:setup` покажет, что удалить, и спросит подтверждение |

---

## Разработка

Репозиторий — исходники плагина и одновременно маркетплейс.

```
src/
├── locales/ru/
│   ├── soul/        core.md (сжатая душа для хука), identity.md, agents.md, messages.sh
│   ├── skills/      справочники и опросники
│   ├── agents/      19 субагентов
│   ├── profiles/    профили стека
│   └── templates/   шаблоны .soul/ для setup
└── shared/hooks/    session-start (bash), run-hook.cmd (Windows), hooks.json
tools/src/           сборщик и валидатор (TypeScript)
plugins/             собранные плагины — генерируются, коммитятся
```

```bash
npm install
npm run build     # src/ → plugins/ и .claude-plugin/marketplace.json
npm test          # хук, сборка, валидатор
npm run check     # валидатор + собранный плагин совпадает с исходниками
claude --plugin-dir plugins/agentsoul-ru   # попробовать вживую
```

Правила разработки — в `.soul/local/dogfood.md`. Дизайн — в `docs/superpowers/specs/`.

## Происхождение

Проект вырос из [imfozilbek/agentsoul](https://github.com/imfozilbek/agentsoul) (автор — samiyev). Начиная с 0.2 — самостоятельная переработка; с 0.3 — плагин Claude Code. Философия и тексты агентов исходного проекта сохранены. Обёртка хука для Windows адаптирована из [obra/superpowers](https://github.com/obra/superpowers) (MIT).

## Лицензия

MIT — см. [LICENSE](./LICENSE).

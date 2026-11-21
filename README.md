# AgentSoul

[![npm version](https://img.shields.io/npm/v/@samiyev/agentsoul.svg?style=flat-square)](https://www.npmjs.com/package/@samiyev/agentsoul)
[![CI](https://github.com/imfozilbek/agentsoul/actions/workflows/ci.yml/badge.svg)](https://github.com/imfozilbek/agentsoul/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@samiyev/agentsoul.svg?style=flat-square)](./LICENSE)
[![node](https://img.shields.io/node/v/@samiyev/agentsoul.svg?style=flat-square)](https://nodejs.org)

Переиспользуемый soul-kit для Claude Code: идентичность, философия, справочные гайды и команда специалистов. Ставится в любой проект одной командой, безопасно обновляется и проверяет сам себя.

> Один раз определил принципы, ценности и архитектурные правила — и применяешь их во всех проектах одинаково, а проектные отличия держишь в отдельном слое, который обновления никогда не трогают.

---

## Три слоя

Слои разделены по тому, как Claude Code реально загружает контекст:

| Слой | Где в проекте | Как попадает в контекст | Что внутри |
|---|---|---|---|
| **Soul** | `.soul/` | Всегда (импорт в `CLAUDE.md`) | `identity.md`, `agents.md`, `stack.md`, `glossary.md`, **`local/*.md`** |
| **Skills** | `.claude/skills/` | По требованию, в контекст вызывающего | 4 справочных гайда + 2 опросника первичной настройки |
| **Субагенты** | `.claude/agents/` | Изолированный процесс | 19 исполнителей с узкими правами (RO/RW) и явной `model` |

Почему так: у субагента изолированный контекст, он не может спросить пользователя и не может вызвать другого субагента. Поэтому знание (гайды) и диалог (опросники) — это skills, а самостоятельная работа — субагенты. Нужные гайды субагенты получают при старте через поле `skills:`.

## Установка

```bash
npm install -D @samiyev/agentsoul
npx agentsoul profiles                     # blank | node-api | nextjs-prisma
npx agentsoul init --profile node-api      # --dry-run, чтобы сначала посмотреть план
```

`init` **никогда не перезаписывает** существующие файлы. Если в проекте уже есть, например, свой `.claude/agents/code-reviewer.md`, он останется, а версия kit ляжет рядом как `code-reviewer.md.agentsoul-new`. В существующий `CLAUDE.md` добавляется управляемый блок, остальной текст не трогается.

После установки:

1. Перезапусти Claude Code — skills и субагенты обнаруживаются при старте сессии.
2. `/project-initializer` — опросник заполнит поля `TBD` в `.soul/stack.md` (профиль заполнил часть заранее).
3. `/glossary-initializer` — зафиксирует bounded contexts и термины в `.soul/glossary.md`.
4. Проектные правила — в `.soul/local/rules.md`, модели субагентов — в `.soul/config.json`.
5. `npx agentsoul check`.

## Что принадлежит кому

| Файлы | Владелец | `update` |
|---|---|---|
| `.soul/identity.md`, `agents.md`, `README.md`, `.claude/skills/**`, `.claude/agents/*` | AgentSoul | обновляет, если ты их не правил |
| `.soul/stack.md`, `glossary.md`, `config.json` | проект | не трогает (только создаёт, если файла нет) |
| `.soul/local/*.md` | проект | не трогает, подключает в `CLAUDE.md` последними — они сильнее всего |
| `.soul/.agentsoul.json` | CLI | манифест: версия, профиль, sha256 каждого управляемого файла |

## Обновление

```bash
npm update @samiyev/agentsoul
npx agentsoul update --dry-run    # план: что обновится, что останется, где конфликт
npx agentsoul update
```

Для каждого управляемого файла `update` сравнивает три хеша: на диске, в манифесте (версия, которую проект принял последней) и в новой версии kit:

| Ситуация | Действие |
|---|---|
| Ты файл не трогал | обновляется |
| Ты правил, kit не менялся | остаётся твоя версия |
| Правили оба | **конфликт**: твоя версия остаётся, новая пишется рядом как `*.agentsoul-new` |
| Kit удалил файл, ты не трогал | удаляется (с бэкапом) |
| Kit удалил файл, ты правил | остаётся, перестаёт отслеживаться |

Конфликт разрешается так: слей нужное (проектные правила — в `.soul/local/`), затем `npx agentsoul update --resolve <path>`. Или `--force` — взять версию kit для всех конфликтов. Всё перезаписанное или удалённое сохраняется в `.soul/.backup/<timestamp>/`.

**Миграция с 0.1.x** выполняется той же командой `update`. В пакете есть таблица хешей файлов из релизов 0.1.0/0.1.1, поэтому нетронутые файлы обновятся чисто, а в конфликт попадут только реально изменённые. Агенты-гайды из 0.1 удаляются (теперь это skills), `scripts/check-soul.sh` тоже (валидатор теперь в CLI).

## Модели субагентов

У каждого агента в kit есть `model` по умолчанию: `opus` у проектировщиков, ревьюера и аналитиков, `sonnet` у git, release и deploy. Проект переопределяет её в `.soul/config.json`:

```json
{
    "profile": "node-api",
    "models": {
        "default": "opus",
        "agents": { "git-specialist": "sonnet" }
    }
}
```

`default: null` оставляет значения kit. После правки запусти `npx agentsoul update`: CLI перепишет строку `model:` во frontmatter, остальной файл не меняется. Допустимые значения: `inherit`, `opus`, `sonnet`, `haiku`, `fable`, полный id `claude-*`.

## Проверка

`npx agentsoul check` проверяет установку строго по манифесту. Оценивается только то, что ставил AgentSoul, поэтому собственные агенты проекта отчёт не засоряют:

- frontmatter агентов и skills: `name` совпадает с именем файла или каталога, есть `description`, `tools` — известные инструменты, `model` допустима, `skills:` ссылается на существующие skills;
- в таблицах `.soul/agents.md` ровно по одной строке на каждого агента и skill, без лишних;
- drift управляемых файлов, нерешённые `*.agentsoul-new`, пропавшие файлы;
- `CLAUDE.md`: блок на месте, импорты существуют, все `.soul/local/*.md` подключены;
- модель во frontmatter совпадает с `config.json`;
- незаполненные `stack.md` и `glossary.md` (предупреждение).

Код выхода 1 — если есть ошибки. Предупреждения на код выхода не влияют.

## Команды

```bash
agentsoul init     [-t <dir>] [-p <profile>] [-n]          # установить (никогда не перезаписывает)
agentsoul update   [-t <dir>] [-n] [-f] [-r <path>]...      # обновить; -f с бэкапом; -r принять слияние
agentsoul check    [-t <dir>] [--source]                    # проверить установку / исходники core/
agentsoul profiles                                          # список профилей стека
```

`update` возвращает код 2, если остались конфликты. Это удобно для CI.

## Разработка AgentSoul

```bash
npm install
npm test               # сборка + node:test (сценарии init/update/check, негативные тесты валидатора)
npm run check          # check --source (core/) + check (установка в самом репо)
npm run dogfood        # пересобрать .soul/ и .claude/ репозитория из core/
```

Источник истины — `core/`:

```
core/
├── soul/              identity.md, agents.md, README.md        → .soul/
├── skills/<name>/     SKILL.md                                 → .claude/skills/
├── agents/<name>.md   19 исполнителей                          → .claude/agents/
├── seed/              glossary.md, config.json, local/rules.md → .soul/ (один раз)
├── profiles/<name>/   stack.md + profile.json                  → .soul/stack.md (один раз)
└── legacy/0.1.json    хеши релизов 0.1.x для миграции
```

AgentSoul установлен сам в себя (dogfood): `.soul/` и `.claude/` в корне — результат `npm run dogfood`, а правила работы с репозиторием лежат в `.soul/local/dogfood.md`.

## Лицензия

MIT.

# Прогон 1 — плагин agentsoul-ru: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Рабочий плагин `agentsoul-ru`, который ставится через `/plugin` из маркетплейса `aibatjardem/agentsoul`, загружает сжатую душу хуком при старте, даёт `setup` и 19 агентов.

**Architecture:** Исходники комплекта — `src/locales/ru/` и `src/shared/`; TypeScript-инструменты в `tools/` собирают их в `plugins/agentsoul-ru/` (коммитится) и `.claude-plugin/marketplace.json`, валидируют и проверяют, что собранное не отстало от исходников. Хук — bash без внешних утилит.

**Tech Stack:** TypeScript 5 (ESM, strict), node:test, `yaml`, bash; Claude Code CLI 2.1.330 (`claude plugin validate`, `claude -p --plugin-dir`) — только для ручной/локальной проверки.

**Spec:** `docs/superpowers/specs/2026-11-21-agentsoul-plugin-multilang-design.md`

## Global Constraints

- Имя плагина `agentsoul-ru`, маркетплейса `agentsoul`; id агентов и skills — `agentsoul-ru:<имя>`; в исходниках префикс пишется как `{{plugin}}`.
- `additionalContext` хука ≤ 9 000 символов; статическое ядро души ≤ 6 500 символов.
- Frontmatter агентов: только `name`, `description`, `tools`, `model`, `skills`; `model: inherit`; `tools` каждого агента включает `Skill`; `description` — на английском.
- Хук: `startup|clear|compact`, bash только со встроенными средствами, всегда exit 0 и валидный JSON; запуск через `run-hook.cmd`.
- Версия: одна, из `package.json`, пишется в `plugin.json`; в `marketplace.json` версии нет.
- Файлы проекта `.soul/stack.md`, `.soul/glossary.md`, `.soul/local/*.md` плагин не перезаписывает никогда.
- Английская локаль не строится; код сборки и валидатора работает с любым набором локалей из `src/locales/`.

## Review Focus

1. Хук в проекте без `.soul/` и в корне без прав на чтение — должен выдать подсказку про setup, не упасть. → тест в Task 3.
2. Огромный `local/*.md` (больше остатка бюджета) — контекст не превышает 9 000, вместо содержимого путь и «прочитай». → тест в Task 3.
3. Кавычки, обратные слэши, табы, CRLF в `local/*.md` — JSON остаётся валидным. → тест в Task 3.
4. `CLAUDE_PROJECT_DIR` не задан — хук берёт текущую директорию. → тест в Task 3.
5. Забыли пересобрать плагин после правки исходников — CI падает с понятным сообщением. → тест в Task 4.

---

### Task 1: Спайк — как плагинный агент подгружает skills

**Files:** Create (временно, в scratchpad): `spike/agents/probe-bare.md`, `spike/agents/probe-ns.md`, `spike/skills/codeword/SKILL.md`, `spike/.claude-plugin/plugin.json`, `spike/hooks/hooks.json`, `spike/hooks/session-start`. Modify: спек, раздел «Риски» п.1 — записать результат.

- [ ] Skill `codeword` содержит уникальное слово; `probe-bare` — `skills: [codeword]`, `probe-ns` — `skills: [spike:codeword]`; оба без инструментов, задача — «назови кодовое слово из контекста или скажи NONE».
- [ ] Хук выдаёт `additionalContext` со вторым уникальным словом.
- [ ] `claude -p --plugin-dir spike "…"`: главный агент называет слово хука; вызывает `spike:probe-bare` и `spike:probe-ns`, каждый возвращает слово или NONE.
- [ ] Записать в спек, какая форма работает; от неё зависят Task 2 и 5. Если ни одна — агенты загружают общие гайды через Skill (запасной путь из спека).

### Task 2: Перенос исходников в `src/locales/ru` и `tools/`

**Files:** Move: `src/*.ts` → `tools/src/`; `core/soul`, `core/skills`, `core/agents`, `core/profiles`, `core/seed` → `src/locales/ru/{soul,skills,agents,profiles,templates}`. Delete: `core/legacy/`, `tools/src/kit/install.ts`, `manifest.ts`, `config.ts`, `claude-md.ts`, `safe-fs.ts`, `commands/{init,update}.ts`, старые тесты установки, корневые `.claude/`, `.soul/{identity,agents,README}.md`, `.soul/.agentsoul.json`, `.soul/config.json`, `.github/workflows/publish.yml`. Modify: `tsconfig.json` (rootDir `tools/src`, outDir `tools/dist`), `package.json` (`private: true`, без `bin`, скрипты `build`, `build:plugins`, `test`, `check`).

- [ ] Профили `node-api`, `nextjs-prisma` → `ts-node-api`, `ts-nextjs`; `blank` остаётся.
- [ ] `npx tsc` собирается (пустая сборка кроме общих модулей допустима до Task 4).

### Task 3: Хук `session-start` и сжатая душа

**Files:** Create: `src/shared/hooks/hooks.json`, `src/shared/hooks/run-hook.cmd` (по образцу superpowers 7.0.0: polyglot cmd/bash, поиск Git Bash, тихий выход без bash), `src/shared/hooks/session-start`, `src/locales/ru/soul/core.md`, `src/locales/ru/soul/messages.sh` (строки хука на языке локали: `MSG_NO_SOUL`, `MSG_HAS_SOUL`, `MSG_READ`, `MSG_LEGACY`, `MSG_TRUNCATED`). Test: `test/hook.test.mjs`.

**Interfaces:** Produces: хук читает `${PLUGIN_ROOT}/hooks/soul-core.md` и `${PLUGIN_ROOT}/hooks/messages.sh` (их кладёт сборщик), выводит `{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"…"}}`.

- [ ] Тесты (запуск скрипта через `bash`, `CLAUDE_PLUGIN_ROOT`=собранная тестовая папка, `CLAUDE_PROJECT_DIR`=temp):
  - `no soul → hint`: нет `.soul/` → контекст содержит ядро и `/agentsoul-ru:setup`; JSON парсится.
  - `soul → paths + languages`: `stack.md` со строкой `- **Языки:** Python, TypeScript` → в контексте пути `.soul/stack.md`, `.soul/glossary.md` и `Python, TypeScript`.
  - `local inlined`: `local/rules.md` малого размера → его текст есть в контексте.
  - `local too big`: 20 000 символов → контекст ≤ 9 000, есть путь и пометка «прочитай».
  - `escaping`: `local` с `"`, `\`, табом, CRLF → JSON валиден, текст сохранён.
  - `no CLAUDE_PROJECT_DIR`: берётся `cwd`.
  - `legacy 0.2`: есть `.soul/.agentsoul.json` → в контексте подсказка про миграцию через setup.
- [ ] `core.md` ≤ 6 500 символов: кто я, красные линии, иерархия, как спрашивать, карта одной строкой на каждого агента/skill с полным id, правило старта. Строка про `any` → «Не отключаю проверку типов и линтер ради скорости».
- [ ] Хук: bash-builtins, `$(<file)`, экранирование как в superpowers, сборка контекста в порядке ядро → состояние проекта → local; обрезка по бюджету.

### Task 4: Сборщик `tools/src/build.ts`

**Files:** Create: `tools/src/build.ts`, `tools/src/plugin-meta.ts`. Test: `test/build.test.mjs`.

**Interfaces:** Produces: `buildLocale(srcRoot: string, locale: string, version: string): FileMap` (путь в плагине → содержимое); `buildAll(repoRoot: string): FileMap` (все локали + `.claude-plugin/marketplace.json`, пути от корня репо); CLI `node tools/dist/build.js [--check]`.

- [ ] Тесты: `plugin.json` с `name: agentsoul-ru`, `version` из package.json; `marketplace.json` с `name: agentsoul`, плагином `{name, source: "./plugins/agentsoul-ru", description}` без `version`; `{{plugin}}` заменён везде, ни одного остатка; `hooks/soul-core.md` = `soul/core.md`; skill `soul` = полный `identity.md` + `agents.md`; агенты и skills скопированы с подстановкой; `--check` возвращает 1 и список файлов, если `plugins/` отличается, и 0 после сборки.
- [ ] Сборка пишет только в `plugins/` и `.claude-plugin/`, удаляет в `plugins/agentsoul-<loc>/` файлы, которых нет в результате.

### Task 5: Контент ru — агенты, skills, setup

**Files:** Modify: `src/locales/ru/agents/*.md` (19), `src/locales/ru/skills/*/SKILL.md`, `src/locales/ru/soul/{identity,agents}.md`, `src/locales/ru/templates/stack.md`. Create: `src/locales/ru/skills/setup/SKILL.md`. Rewrite: `agents/soul-keeper.md`.

- [ ] Все агенты: `model: inherit`, `Skill` в `tools`, `skills:` в форме из Task 1, преамбула: прочитать `.soul/local/*.md`, `.soul/stack.md` (строка «Языки») и загрузить `{{plugin}}:lang-<язык>`, если такой skill есть; stop-режим ссылается на `/{{plugin}}:project-initializer`.
- [ ] Все упоминания агентов и skills в текстах — `{{plugin}}:<имя>`; `agents.md`: раздел про модели и `config.json` удалён, правило «по одному» остаётся.
- [ ] `templates/stack.md` и профили: поле `- **Языки:**` первым в «Базовое».
- [ ] `project-initializer`: первый вопрос — языки (несколько можно), дальнейшие варианты — для выбранного языка (подробные варианты по языкам — прогон 2).
- [ ] `setup`: шаги — найти старую установку (признаки из спека) → показать список удаления → подтверждение → удалить; затем новый/существующий проект, языки, профиль или опросник, glossary; создать `.soul/stack.md`, `glossary.md`, `local/rules.md`, только если их нет; в конце — что закоммитить.
- [ ] `soul-keeper`: новая роль из спека (п. 5 решений).

### Task 6: Валидатор `tools/src/validate.ts`

**Files:** Rewrite: `tools/src/validate.ts`, `tools/src/frontmatter.ts` (сохранить). Test: `test/validate.test.mjs`.

**Interfaces:** Produces: `validateSources(repoRoot: string): Issue[]` (`Issue = {level: "error"|"warning", where, message}`); CLI `node tools/dist/check.js` = валидатор + `build --check`.

- [ ] Тесты (позитив на реальных исходниках, негативы на копии): неизвестное поле frontmatter (`hooks`), `model` не из списка, агент без `Skill` в tools, `skills:` на несуществующий skill, `{{plugin}}:ghost` в тексте, строка индекса без агента и агент без строки, `core.md` > 6 500 символов, `bash -n` хука падает, разные наборы агентов/skills/профилей в двух локалях (фикстура `en`).

### Task 7: Репозиторий, CI, README, живая проверка

**Files:** Modify: `.github/workflows/ci.yml` (typecheck → build → test → check), `README.md` (для новичка: установка через `/plugin`, setup, обновление, автообновление; разработка), `.soul/stack.md`, `.soul/glossary.md`, `.soul/local/dogfood.md` (новое устройство). Delete: старые разделы про npm.

- [ ] `npm test` и `npm run check` зелёные; `claude plugin validate .` без ошибок.
- [ ] `claude -p --plugin-dir plugins/agentsoul-ru` в temp-проекте без `.soul/`: в ответе на «что ты знаешь о проекте и какие у тебя агенты» есть подсказка setup и id агентов с префиксом.
- [ ] То же в проекте с `.soul/stack.md` (Python): упоминание стека.
- [ ] Коммит, пуш, CI зелёный; владелец ставит из маркетплейса у себя.

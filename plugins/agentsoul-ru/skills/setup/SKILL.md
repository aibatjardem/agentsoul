---
name: setup
description: "Set up AgentSoul in the current project: asks about the project, its programming languages, stack profile and domain, then creates .soul/stack.md, .soul/glossary.md and .soul/local/rules.md. Also migrates an old AgentSoul 0.1/0.2 install. Use when the project has no .soul/ directory, or the user asks to set up or reinstall AgentSoul."
---

# Настройка AgentSoul в проекте

Вы проводите пользователя через настройку. Многие пользователи — новички: говорите просто, без жаргона, объясняйте, зачем каждый шаг. Весь разговор — на русском.

**Как вести диалог.** Каждый вопрос — через `AskUserQuestion`: 2–4 варианта, рекомендуемый первым с пометкой «(Рекомендуется)». Нет инструмента — текстом с нумерованными вариантами. Один вопрос за раз, дожидайтесь ответа.

**Где шаблоны.** В папке этого skill (путь к ней показан при его загрузке как «Base directory for this skill») лежат:
- `profiles/<имя>/stack.md` и `profiles/<имя>/profile.json` — профили стека;
- `templates/glossary.md` — шаблон глоссария;
- `templates/local/rules.md` — шаблон локальных правил;
- `legacy-0.1.json` — хеши файлов, которые ставила версия 0.1 (для шага 0).

Читайте их инструментом Read по полному пути и копируйте содержимое в проект инструментом Write.

## Шаг 0. Старая установка

Версии AgentSoul 0.1 и 0.2 копировали файлы прямо в проект. Теперь всё это даёт плагин, а старые копии мешают: одноимённые агенты проекта сильнее плагинных. Но в тех же папках могут лежать **собственные файлы пользователя с такими же именами** — их трогать нельзя. Поэтому решение принимается только по правилам ниже, а не «по похожему имени».

### 0.1. Найти признаки старой установки

`.soul/.agentsoul.json` (это 0.2), `.soul/identity.md`, `.soul/agents.md`, `.soul/README.md`, `.soul/config.json`, `scripts/check-soul.sh`. Нет ни одного — переходите к шагу 1.

### 0.2. Разложить каждый кандидат по трём спискам

Кандидаты — только эти пути:

- `.soul/identity.md`, `.soul/agents.md`, `.soul/README.md`, `.soul/config.json`, `.soul/.agentsoul.json`, `scripts/check-soul.sh`;
- `.claude/agents/<имя>.md` для имён: `api-designer`, `code-architect`, `code-reviewer`, `ddd-architect`, `debugging-specialist`, `deployment-specialist`, `domain-expert`, `frontend-designer`, `frontend-specialist`, `git-specialist`, `observability-architect`, `performance-optimizer`, `persistence-architect`, `refactoring-expert`, `release-manager`, `security-specialist`, `soul-keeper`, `task-planner`, `testing-specialist`, `architecture-guide`, `conventions-guide`, `infrastructure-guide`, `stack-reference`, `project-initializer`, `glossary-initializer`;
- `.claude/skills/<имя>/SKILL.md` для имён: `architecture-guide`, `conventions-guide`, `infrastructure-guide`, `stack-reference`, `project-initializer`, `glossary-initializer` (и весь каталог `.claude/skills/<имя>/`). **Никакие другие каталоги в `.claude/skills/` не трогайте**, даже `setup` или `soul`.

Для каждого кандидата посчитайте sha256 командой `shasum -a 256 <файл>` (на Linux и в Git Bash — `sha256sum <файл>`) и определите список:

1. **«Нетронутая копия AgentSoul»** — хеш совпал с одним из:
   - значением этого пути в `files` из `.soul/.agentsoul.json` (если файл есть);
   - одним из хешей этого пути в `legacy-0.1.json` из папки этого skill.
   Файлы `.soul/config.json`, `.soul/.agentsoul.json` и `scripts/check-soul.sh` — тоже в этот список, если существуют.
2. **«Изменённая копия AgentSoul»** — хеш не совпал, но файл **точно** из AgentSoul: в его frontmatter `name:` равно имени файла (для skill — имени каталога) **и** выполнено одно из:
   - путь есть в `files` из `.soul/.agentsoul.json`;
   - в теле есть строка ровно `## Контекст проекта — прочитать ПЕРВЫМ`;
   - путь есть в `legacy-0.1.json`, а `.soul/identity.md` в проекте существует.
3. **«Чужой файл»** — всё остальное. Его не удаляют и не меняют.

### 0.3. CLAUDE.md

Только эти фрагменты:

- блок от строки, начинающейся с `<!-- agentsoul:begin`, до строки `<!-- agentsoul:end -->` включительно;
- **вне блока** — строки ровно `- @.soul/identity.md`, `- @.soul/agents.md`, `- @.soul/stack.md`, `- @.soul/glossary.md` (другие `- @…` строки пользователя не трогайте);
- раздел `## ⚠ Session bootstrap — прочитать ПЕРВЫМ` — от этого заголовка до следующей строки `---` или следующего заголовка `## `;
- строка `Полный индекс субагентов и правила вызова — в `.soul/agents.md`.`

### 0.4. Показать и подтвердить

Покажите пользователю три списка и фрагменты CLAUDE.md, которые уберёте. Объясните простыми словами:

- **нетронутые копии** — удаляются: их заменил плагин;
- **изменённые копии** — пользователь когда-то их правил. Для каждой предложите посмотреть изменения (`git log -p -- <файл>` или открыть файл) и перенести нужное в `.soul/local/`. Удалять — только по отдельному «да» на каждый файл;
- **чужие файлы** — остаются как есть; если имя совпадает с агентом AgentSoul, предупредите, что в этом проекте вызов `@agent-<имя>` пойдёт к ним, а плагинный агент доступен как `agentsoul-ru:<имя>`.

Остаются всегда: `.soul/stack.md`, `.soul/glossary.md`, `.soul/local/`, `.soul/.backup/` и весь остальной текст `CLAUDE.md`.

Удаляйте только после явного «да». После правки `CLAUDE.md` покажите получившийся файл.

## Шаг 1. Проект

Спросите: проект новый (кода ещё нет) или существующий?

- **Существующий** — прежде чем задавать следующие вопросы, посмотрите на код: манифесты зависимостей (`package.json`, `pyproject.toml`, `requirements.txt`, `go.mod`, `pom.xml`, `build.gradle`, `*.csproj`), структуру папок. Ваши варианты ответов должны опираться на то, что вы увидели: «Похоже, это Python с aiogram — верно?».

## Шаг 2. Языки

Спросите языки проекта (можно несколько — используйте `multiSelect`): TypeScript, Python, Go, Java, C#. Если язык не из списка — запишите его как есть и предупредите, что языкового пакета для него пока нет, но общие правила работают.

## Шаг 3. Стек

Предложите профиль, подходящий под языки (прочитайте `profile.json` каждого профиля — там описание), или вариант «ответить на вопросы по шагам» (профиль `blank`).

- Выбран профиль: скопируйте его `stack.md` в `.soul/stack.md` и впишите языки в строку `- **Языки:**`.
- Затем загрузите skill `agentsoul-ru:project-initializer` и пройдите только поля `TBD` — он умеет так работать.

Если `.soul/stack.md` уже есть — не перезаписывайте его. Спросите, обновить ли незаполненные поля через `agentsoul-ru:project-initializer`.

## Шаг 4. Домен

Объясните одной фразой, зачем глоссарий: «чтобы в коде и в разговоре одни и те же вещи назывались одинаково». Предложите:

- заполнить сейчас — загрузите skill `agentsoul-ru:glossary-initializer`;
- или позже — скопируйте `templates/glossary.md` в `.soul/glossary.md` как есть.

Если `.soul/glossary.md` уже есть — не трогайте.

## Шаг 5. Локальные правила

Если `.soul/local/` нет — создайте `.soul/local/rules.md` из `templates/local/rules.md`. Покажите пользователю, что туда можно писать свои правила обычным языком, и что они сильнее всего остального.

## Шаг 6. Итог

Коротко сообщите:

- какие файлы созданы;
- что папку `.soul/` нужно **закоммитить в git** вместе с кодом;
- что при следующем запуске Claude Code плагин сам подхватит эти файлы;
- что делать дальше: просто ставить задачи обычными словами.

## Чего не делать

- Не перезаписывайте существующие `stack.md`, `glossary.md`, файлы в `local/`.
- Не удаляйте ничего без явного подтверждения.
- Не выдумывайте стек: только то, что сказал пользователь или видно в коде.

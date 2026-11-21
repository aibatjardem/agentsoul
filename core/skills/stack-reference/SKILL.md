---
name: stack-reference
description: "Use when you need to look up the standard command surface for any package in the project (build, test, lint, format, typecheck, dev). Short, operational reference. For the actual project tech stack, read .soul/stack.md instead — this agent only knows the command *shape*, not the tools behind it."
---

## Справочник команд

> Этот агент знает только **форму** команд. Конкретный package manager, test runner, HTTP framework и прочие инструменты живут в `.soul/stack.md`. Если нужно узнать, какой именно тест-раннер используется в проекте — читай `stack.md`, не меня.

---

### Корневая команда — единственная

```bash
<package-manager> install                           # Установка зависимостей — единственная команда, запускаемая из корня монорепо
```

Корневой `package.json` — это координатор, а не рабочий. Вся остальная работа происходит внутри конкретных пакетов.

### Повседневный набор (внутри каждого пакета)

```bash
cd <package-dir> && <run> build                     # Сборка
cd <package-dir> && <run> clean                     # Очистка артефактов
cd <package-dir> && <run> format                    # Форматирование
cd <package-dir> && <run> format:check              # Проверка форматирования (CI)
cd <package-dir> && <run> lint                      # Статический анализ
cd <package-dir> && <run> test                      # Все тесты пакета
cd <package-dir> && <run> test <file>               # Один тестовый файл
cd <package-dir> && <run> typecheck                 # Проверка типов
```

Эти команды **идентичны для каждого пакета** — это сознательное требование консистентности. Мышечная память работает одинаково везде.

### Entrypoints

```bash
cd <entrypoints-dir> && <run> dev:<process-name>    # Dev-режим процесса (watch)
cd <entrypoints-dir> && <run> start:<process-name>  # Продакшн-режим процесса
```

`<process-name>` — например `api`, `worker`, `scheduler`, `webhooks`. Конкретный список процессов проекта — в `.soul/stack.md` / коде entrypoints.

### Frontend (если есть UI-пакет)

```bash
cd <ui-dir> && <run> dev                            # Dev-сервер
cd <ui-dir> && <run> build                          # Production build
cd <ui-dir> && <run> test                           # Тесты UI
cd <ui-dir> && <run> codegen                        # Генерация типов из API schema
```

---

### Почему контекст запуска критичен

В монорепо с workspace-пакетами запуск команды не из той директории silently делает не то, что ожидается: пути, конфигурация, переменные окружения — всё окажется не тем, чем должно быть. Silent failure — худший вид бага.

**Запрещено:**

```bash
<test-runner> <package-path>/tests/file.test.ts     # НЕ работает — cwd не совпадает с контекстом пакета
```

Всегда `cd <package-dir> && <run> ...`, никогда — запуск тест-раннера с путём в параметре.

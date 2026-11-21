---
name: agentsoul
description: "AgentSoul main menu: shows whether AgentSoul is set up in this project, the project's languages, stack and local rules, and offers the next actions (set up, update stack, add terms, audit .soul/, review). Use when the user types /agentsoul, asks what AgentSoul can do, or does not know which AgentSoul command to run."
---

# AgentSoul — главное меню

Пользователь вызвал AgentSoul, не зная точной команды. Чаще всего это новичок: говорите просто, коротко, на русском.

## 1. Посмотрите на проект

Проверьте в корне проекта (инструментами Read/Glob, без лишних слов пользователю):

- есть ли папка `.soul/`;
- `.soul/stack.md` — строка «Языки», есть ли значения `TBD`;
- `.soul/glossary.md` — есть ли `TBD`;
- файлы в `.soul/local/`;
- признаки старой установки AgentSoul: `.soul/.agentsoul.json`, `.soul/identity.md`.

## 2. Покажите состояние — в 3–5 строк

Например:

> **AgentSoul в этом проекте:** настроен
> **Языки:** Python · **Стек:** aiogram 3, PostgreSQL
> **Словарь:** 6 терминов · **Свои правила:** `local/rules.md`
> ⚠ В стеке не заполнены: хостинг, CI

Если `.soul/` нет — одной фразой: «AgentSoul в этом проекте ещё не настроен».

## 3. Предложите действия

Через `AskUserQuestion`, 2–4 варианта, самый полезный сейчас — первым с пометкой «(Рекомендуется)». Подбирайте по состоянию:

| Состояние | Что предложить первым |
|---|---|
| нет `.soul/` или найдена старая установка | Настроить проект → загрузите skill `{{plugin}}:setup` |
| в `stack.md` есть `TBD` | Заполнить стек → `{{plugin}}:project-initializer` |
| в `glossary.md` есть `TBD` | Добавить термины → `{{plugin}}:glossary-initializer` |
| всё заполнено | Проверить, что `.soul/` совпадает с кодом → субагент `{{plugin}}:soul-keeper` |

Остальные варианты — из этого же списка, плюс:

- «Проверить последние изменения» → субагент `{{plugin}}:code-reviewer`;
- «Добавить своё правило» → спросите правило обычными словами и допишите в `.soul/local/rules.md` после подтверждения текста.

Выбранное действие выполните сразу — загрузите нужный skill или вызовите субагента.

## 4. Подсказка в конце

Если пользователь отказался от действий или закончил, покажите коротко:

```
/agentsoul                              это меню
/{{plugin}}:setup                       настроить проект
/{{plugin}}:project-initializer         обновить стек
/{{plugin}}:glossary-initializer        добавить термины
@agent-{{plugin}}:code-reviewer         позвать специалиста
```

И одну фразу: «А обычно просто пиши задачу словами — остальное я сделаю сам».

import { resolve, join } from "node:path"
import { existsSync, readFileSync } from "node:fs"
import { resolveCoreDir } from "../lib/paths.js"
import { copyTree, writeFileSafe } from "../lib/fs-ops.js"

interface InitOptions {
    target: string
    force: boolean
}

/**
 * Устанавливает AgentSoul в целевой проект:
 *   core/soul/*            → <target>/.soul/*
 *   core/claude-agents/*   → <target>/.claude/agents/*
 *   core/scripts/*         → <target>/scripts/*
 *
 * Генерирует <target>/CLAUDE.md, если его нет.
 *
 * По умолчанию не перезаписывает существующие файлы (safe mode).
 * Флаг --force меняет поведение на overwrite.
 */
export function runInit(options: InitOptions): void {
    const core = resolveCoreDir()
    const target = resolve(options.target)
    const onExist = options.force ? "overwrite" : "skip"

    console.log(`AgentSoul init → ${target}`)
    console.log(`  core: ${core}`)
    console.log(`  mode: ${options.force ? "overwrite" : "safe (skip existing)"}`)
    console.log("")

    const soulResult = copyTree(join(core, "soul"), join(target, ".soul"), onExist)
    const agentsResult = copyTree(
        join(core, "claude-agents"),
        join(target, ".claude", "agents"),
        onExist,
    )
    const scriptsResult = copyTree(
        join(core, "scripts"),
        join(target, "scripts"),
        onExist,
    )

    // Write CLAUDE.md if missing
    const claudeMdPath = join(target, "CLAUDE.md")
    const claudeMdContent = buildClaudeMd()
    const claudeResult = writeFileSafe(claudeMdPath, claudeMdContent, options.force)

    // Summary
    const total =
        soulResult.copied.length +
        agentsResult.copied.length +
        scriptsResult.copied.length +
        (claudeResult.written ? 1 : 0)
    const skipped =
        soulResult.skipped.length +
        agentsResult.skipped.length +
        scriptsResult.skipped.length +
        (claudeResult.written ? 0 : 1)

    console.log(`  .soul/           copied ${soulResult.copied.length}, skipped ${soulResult.skipped.length}`)
    console.log(`  .claude/agents/  copied ${agentsResult.copied.length}, skipped ${agentsResult.skipped.length}`)
    console.log(`  scripts/         copied ${scriptsResult.copied.length}, skipped ${scriptsResult.skipped.length}`)
    console.log(
        `  CLAUDE.md        ${claudeResult.written ? "created" : `skipped (${claudeResult.reason})`}`,
    )
    console.log("")
    console.log(`✅ ${total} file(s) installed, ${skipped} skipped`)

    if (skipped > 0 && !options.force) {
        console.log("")
        console.log("ℹ  Use --force to overwrite existing files.")
    }

    console.log("")
    console.log("Next steps:")
    console.log("  1. Restart Claude Code in this project so it discovers the new subagents")
    console.log("  2. Run `project-initializer` subagent to fill .soul/stack.md")
    console.log("  3. Run `glossary-initializer` subagent to fill .soul/glossary.md")
    console.log("  4. Validate: bash scripts/check-soul.sh")
}

function buildClaudeMd(): string {
    return `- @.soul/identity.md
- @.soul/agents.md
- @.soul/stack.md
- @.soul/glossary.md

## ⚠ Session bootstrap — прочитать ПЕРВЫМ

**Перед выполнением любой нетривиальной задачи** проверь состояние baseline-файлов проекта:

1. Если \`.soul/stack.md\` содержит \`TBD\` / "ещё не заполнен" / пустые обязательные разделы → предложи пользователю запустить субагента **\`project-initializer\`** и дождись его завершения, **прежде чем** начинать писать код или архитектуру.
2. Если \`.soul/glossary.md\` содержит \`TBD\` / "ещё не заполнен" → предложи субагента **\`glossary-initializer\`**. Без Ubiquitous Language любая работа с доменом будет рассинхронизирована с командой.

**Исключения из правила** — можно работать даже если baseline пуст:
- Тривиальные правки одного файла, не затрагивающие архитектуру/домен (переименование, форматирование, очевидные bug fix)
- Исследовательские запросы ("где живёт X?", "как работает Y?")
- Пользователь явно говорит "я знаю что baseline пуст, делай быстро"

Во всех остальных случаях — **сначала инициализация, потом работа**. Иначе советы будут абстрактны и разойдутся с реальностью проекта.

---

Полный индекс субагентов и правила вызова — в \`.soul/agents.md\`.
`
}

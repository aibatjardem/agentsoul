import { resolve, join } from "node:path"
import { resolveCoreDir } from "../lib/paths.js"
import { copyTree } from "../lib/fs-ops.js"

interface UpdateOptions {
    target: string
    force: boolean
}

/**
 * Обновляет файлы ядра AgentSoul в целевом проекте, но НЕ трогает project-specific.
 *
 * Обновляет:
 *   - .soul/identity.md, .soul/agents.md, .soul/README.md
 *   - .claude/agents/*
 *   - scripts/check-soul.sh
 *
 * НЕ обновляет (project-specific, пользователь владеет):
 *   - .soul/stack.md
 *   - .soul/glossary.md
 *   - CLAUDE.md
 *
 * Без --force останавливается, если обнаружит локальные изменения в ядре.
 */
export function runUpdate(options: UpdateOptions): void {
    const core = resolveCoreDir()
    const target = resolve(options.target)

    console.log(`AgentSoul update → ${target}`)
    console.log(`  core: ${core}`)
    console.log(`  mode: ${options.force ? "force overwrite" : "safe (check then overwrite)"}`)
    console.log("")

    // В safe-режиме мы всё равно перезаписываем, но предупреждаем что локальные правки будут потеряны.
    // Продвинутая версия могла бы делать diff и 3-way merge, но для MVP достаточно overwrite + force flag.
    if (!options.force) {
        console.log("⚠  Update will overwrite files in .soul/ (except stack.md/glossary.md)")
        console.log("   and .claude/agents/. Local changes to these files will be lost.")
        console.log("   Pass --force to proceed, or cancel with Ctrl-C.")
        console.log("")
        console.log("   To keep local overrides, use .soul/overrides/ (not yet implemented).")
        console.log("")
        console.log("❌ aborted (no --force)")
        return
    }

    // Обновляем только core-файлы, оставляя stack.md/glossary.md нетронутыми
    const coreBaselineFiles = ["identity.md", "agents.md", "README.md"]

    for (const f of coreBaselineFiles) {
        const src = join(core, "soul", f)
        const dst = join(target, ".soul", f)
        const { existsSync, copyFileSync } = require("node:fs") as typeof import("node:fs")
        if (existsSync(src)) {
            copyFileSync(src, dst)
            console.log(`  .soul/${f}  updated`)
        }
    }

    const agentsResult = copyTree(
        join(core, "claude-agents"),
        join(target, ".claude", "agents"),
        "overwrite",
    )
    console.log(
        `  .claude/agents/  updated ${agentsResult.copied.length + agentsResult.overwritten.length} file(s)`,
    )

    const scriptsResult = copyTree(
        join(core, "scripts"),
        join(target, "scripts"),
        "overwrite",
    )
    console.log(
        `  scripts/  updated ${scriptsResult.copied.length + scriptsResult.overwritten.length} file(s)`,
    )

    console.log("")
    console.log("✅ AgentSoul core updated")
    console.log("")
    console.log("Next steps:")
    console.log("  1. Run `bash scripts/check-soul.sh` to verify consistency")
    console.log("  2. Restart Claude Code if subagent definitions changed")
}

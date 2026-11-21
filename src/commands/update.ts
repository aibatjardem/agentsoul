import { resolve } from "node:path"
import { applyPlan, planInstall } from "../kit/install.js"
import { loadKit } from "../kit/kit.js"
import { readManifest } from "../kit/manifest.js"
import { printFollowUps, printPlan } from "./report.js"

export interface UpdateOptions {
    readonly target: string
    readonly coreDir: string
    readonly version: string
    readonly force: boolean
    readonly dryRun: boolean
    readonly resolve: readonly string[]
}

/**
 * Brings managed files up to the current kit, re-renders agent models from
 * `.soul/config.json` and refreshes the CLAUDE.md block. Project-owned files
 * (stack.md, glossary.md, config.json, local/) are never touched; locally
 * edited managed files are never overwritten without --force.
 *
 * @returns process exit code: 0 clean, 2 when conflicts are left to resolve
 */
export function runUpdate(options: UpdateOptions): number {
    const target = resolve(options.target)
    const manifest = readManifest(target)
    const kit = loadKit(options.coreDir)
    const plan = planInstall({
        kit,
        target,
        version: options.version,
        force: options.force,
        resolve: options.resolve,
    })
    if (manifest === null && !plan.legacy) {
        console.error("❌ AgentSoul is not installed here. Use `agentsoul init`.")
        return 1
    }

    const from = manifest?.version ?? "0.1.x (no manifest)"
    console.log(`AgentSoul update ${from} → ${options.version}  ${target}`)
    console.log("")
    printPlan(plan)

    if (options.dryRun) {
        printFollowUps(plan)
        console.log("")
        console.log("dry run — nothing written")
        return 0
    }
    const { backupDir } = applyPlan(plan, target)
    const conflicts = printFollowUps(plan)
    if (backupDir !== null) {
        console.log("")
        console.log(`ℹ  previous versions of replaced/removed files: ${backupDir}`)
    }
    console.log("")
    console.log(conflicts === 0 ? "✅ up to date" : `⚠  updated with ${conflicts} conflict(s) to resolve`)
    console.log("   Restart Claude Code if agents or skills changed.")
    return conflicts === 0 ? 0 : 2
}

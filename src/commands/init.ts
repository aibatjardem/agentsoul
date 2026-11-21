import { resolve } from "node:path"
import { applyPlan, planInstall } from "../kit/install.js"
import { loadKit } from "../kit/kit.js"
import { readManifest } from "../kit/manifest.js"
import { printFollowUps, printPlan } from "./report.js"

export interface InitOptions {
    readonly target: string
    readonly coreDir: string
    readonly version: string
    readonly profile: string
    readonly dryRun: boolean
}

/**
 * First install into a project. Never overwrites: a pre-existing file at a managed
 * path (say, the project's own `.claude/agents/code-reviewer.md`) is kept and the
 * kit version lands next to it as `*.agentsoul-new`.
 *
 * @returns process exit code
 */
export function runInit(options: InitOptions): number {
    const target = resolve(options.target)
    if (readManifest(target) !== null) {
        console.error("❌ AgentSoul is already installed here. Use `agentsoul update`.")
        return 1
    }
    const kit = loadKit(options.coreDir)
    const plan = planInstall({ kit, target, version: options.version, profile: options.profile, force: false })
    if (plan.legacy) {
        console.error("❌ Found an AgentSoul 0.1 install (.soul/ without a manifest). Use `agentsoul update` to migrate it.")
        return 1
    }

    console.log(`AgentSoul ${options.version} init → ${target}  (profile: ${plan.manifest.profile})`)
    console.log("")
    printPlan(plan)
    if (options.dryRun) {
        console.log("")
        console.log("dry run — nothing written")
        return 0
    }
    applyPlan(plan, target)
    printFollowUps(plan)

    console.log("")
    console.log("✅ installed. Next steps:")
    console.log("  1. Restart Claude Code here so it discovers the new skills and subagents")
    console.log("  2. Run skill /project-initializer to fill the TBD fields in .soul/stack.md")
    console.log("  3. Run skill /glossary-initializer to fill .soul/glossary.md")
    console.log("  4. Put project-specific rules into .soul/local/rules.md, models into .soul/config.json")
    console.log("  5. agentsoul check")
    return 0
}

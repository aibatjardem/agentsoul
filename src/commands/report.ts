import type { Action, Plan } from "../kit/install.js"
import { NEW_SUFFIX } from "../kit/install.js"
import type { Issue } from "../kit/validate.js"

const LABEL: Record<Action, string> = {
    add: "+ add",
    update: "↑ update",
    unchanged: "= unchanged",
    "keep-local": "• keep local edit",
    conflict: "! conflict",
    overwrite: "⟳ overwrite (backed up)",
    resolve: "✓ resolved",
    remove: "− remove (backed up)",
    orphan: "? orphan (kept, untracked)",
    seed: "+ seed (project-owned)",
}

/** Prints a plan grouped by action; `unchanged` is summarized, not listed. */
export function printPlan(plan: Plan): void {
    const order: Action[] = ["add", "seed", "update", "overwrite", "resolve", "remove", "keep-local", "orphan", "conflict"]
    for (const action of order) {
        for (const item of plan.items.filter((i) => i.action === action)) {
            console.log(`  ${LABEL[action].padEnd(26)} ${item.path}`)
        }
    }
    const unchanged = plan.items.filter((i) => i.action === "unchanged").length
    if (unchanged > 0) console.log(`  ${LABEL.unchanged.padEnd(26)} ${unchanged} file(s)`)
    if (plan.claudeMd.before !== plan.claudeMd.after) {
        console.log(`  ${(plan.claudeMd.before === null ? "+ add" : "↑ update").padEnd(26)} CLAUDE.md (managed block)`)
    }
}

/** Explains conflicts and orphans after a plan; returns the conflict count. */
export function printFollowUps(plan: Plan): number {
    const conflicts = plan.items.filter((i) => i.action === "conflict")
    const orphans = plan.items.filter((i) => i.action === "orphan")
    if (conflicts.length > 0) {
        console.log("")
        console.log(`⚠  ${conflicts.length} file(s) were edited locally and also changed in the kit.`)
        console.log(`   The new version is written next to each one as *${NEW_SUFFIX}. For each file:`)
        console.log("     1. merge what you need; project-specific rules belong in .soul/local/")
        console.log("     2. agentsoul update --resolve <path>   (accepts your merged file)")
        console.log("   Or take the kit version for all of them: agentsoul update --force (backs up first).")
        if (plan.legacy) {
            console.log("   (Migrating from 0.1: files that matched a 0.1 release byte for byte were updated")
            console.log("   cleanly; only files that differ from every 0.1 release are listed here.)")
        }
    }
    if (orphans.length > 0) {
        console.log("")
        console.log("ℹ  The kit no longer ships these files, but they were edited locally, so they were kept.")
        console.log("   Move your edits to .soul/local/ and delete them — an old agent can shadow a new skill:")
        for (const o of orphans) console.log(`     ${o.path}`)
    }
    return conflicts.length
}

/** Prints validator issues; returns the error count. */
export function printIssues(issues: readonly Issue[]): number {
    const errors = issues.filter((i) => i.level === "error")
    const warnings = issues.filter((i) => i.level === "warning")
    for (const i of errors) console.log(`  ❌ ${i.where}: ${i.message}`)
    for (const i of warnings) console.log(`  ⚠  ${i.where}: ${i.message}`)
    console.log("")
    console.log(`  errors: ${errors.length}, warnings: ${warnings.length}`)
    console.log(errors.length === 0 ? "  ✅ soul-kit is consistent" : "  ❌ soul-kit has errors")
    return errors.length
}

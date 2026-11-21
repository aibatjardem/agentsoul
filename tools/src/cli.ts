#!/usr/bin/env node
/**
 * Developer tool for the AgentSoul repo (not shipped to users):
 *   node tools/dist/cli.js build    render src/ into plugins/ and .claude-plugin/marketplace.json
 *   node tools/dist/cli.js check    validate sources and fail if the committed build is stale
 */
import { buildAll, diffBuild, writeBuild } from "./build.js"
import { repoRoot } from "./paths.js"
import { validateSources } from "./validate.js"

function main(command: string | undefined): number {
    const root = repoRoot()
    if (command === "build") {
        const files = buildAll(root)
        writeBuild(root, files)
        console.log(`built ${files.size} files`)
        return 0
    }
    if (command === "check") {
        const issues = validateSources(root)
        for (const i of issues) console.log(`  ${i.level === "error" ? "❌" : "⚠ "} ${i.where}: ${i.message}`)
        const drift = diffBuild(root, buildAll(root))
        for (const path of drift) console.log(`  ❌ ${path}: differs from a fresh build — run \`npm run build\``)
        const errors = issues.filter((i) => i.level === "error").length + drift.length
        console.log(errors === 0 ? "✅ sources valid, build up to date" : `❌ ${errors} error(s)`)
        return errors === 0 ? 0 : 1
    }
    console.error("usage: cli.js build | check")
    return 2
}

try {
    process.exitCode = main(process.argv[2])
} catch (err) {
    console.error(`❌ ${(err as Error).message}`)
    process.exitCode = 1
}

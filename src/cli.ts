#!/usr/bin/env node
import { Command } from "commander"
import { runInit } from "./commands/init.js"
import { runCheck } from "./commands/check.js"
import { runUpdate } from "./commands/update.js"

const program = new Command()

program
    .name("agentsoul")
    .description("Reusable soul-kit for Claude Code projects — identity, knowledge guides, 25+ subagents")
    .version("0.1.0")

program
    .command("init")
    .description("Install AgentSoul into a target project (safe by default — skips existing files)")
    .option("-t, --target <path>", "Target project directory", process.cwd())
    .option("-f, --force", "Overwrite existing files", false)
    .action((opts: { target: string; force: boolean }) => {
        try {
            runInit({ target: opts.target, force: opts.force })
        } catch (err) {
            console.error(`❌ init failed: ${(err as Error).message}`)
            process.exit(1)
        }
    })

program
    .command("check")
    .description("Run soul-kit consistency validation in the target project")
    .option("-t, --target <path>", "Target project directory", process.cwd())
    .action((opts: { target: string }) => {
        const code = runCheck({ target: opts.target })
        process.exit(code)
    })

program
    .command("update")
    .description("Update AgentSoul core files in the target project (preserves stack.md/glossary.md)")
    .option("-t, --target <path>", "Target project directory", process.cwd())
    .option("-f, --force", "Actually perform the update (without this flag, dry-run warning only)", false)
    .action((opts: { target: string; force: boolean }) => {
        try {
            runUpdate({ target: opts.target, force: opts.force })
        } catch (err) {
            console.error(`❌ update failed: ${(err as Error).message}`)
            process.exit(1)
        }
    })

program.parse()

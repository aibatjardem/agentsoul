#!/usr/bin/env node
import { Command } from "commander"
import { runCheck } from "./commands/check.js"
import { runInit } from "./commands/init.js"
import { runUpdate } from "./commands/update.js"
import { loadKit, DEFAULT_PROFILE } from "./kit/kit.js"
import { defaultCoreDir, packageVersion } from "./kit/paths.js"

const version = packageVersion()
const coreDir = defaultCoreDir()

/** Runs a command and turns thrown errors into a readable message + exit code 1. */
function run(name: string, fn: () => number): void {
    try {
        process.exitCode = fn()
    } catch (err) {
        console.error(`❌ ${name} failed: ${(err as Error).message}`)
        process.exitCode = 1
    }
}

const collect = (value: string, previous: string[]): string[] => [...previous, value]

const program = new Command()
    .name("agentsoul")
    .description("Soul-kit for Claude Code: soul (always loaded) → skills (on demand) → subagents (isolated executors)")
    .version(version)

program
    .command("init")
    .description("Install into a project. Never overwrites existing files")
    .option("-t, --target <path>", "target project directory", process.cwd())
    .option("-p, --profile <name>", "stack profile that pre-fills .soul/stack.md (see `agentsoul profiles`)", DEFAULT_PROFILE)
    .option("-n, --dry-run", "show the plan without writing", false)
    .action((o: { target: string; profile: string; dryRun: boolean }) =>
        run("init", () => runInit({ ...o, coreDir, version })),
    )

program
    .command("update")
    .description("Update managed files; keeps local edits, writes *.agentsoul-new on conflict")
    .option("-t, --target <path>", "target project directory", process.cwd())
    .option("-n, --dry-run", "show the plan without writing", false)
    .option("-f, --force", "replace locally edited managed files with the kit version (backed up first)", false)
    .option("-r, --resolve <path>", "accept your merged version of a conflicted file (repeatable)", collect, [])
    .action((o: { target: string; dryRun: boolean; force: boolean; resolve: string[] }) =>
        run("update", () => runUpdate({ ...o, coreDir, version })),
    )

program
    .command("check")
    .description("Validate an installed project against its manifest")
    .option("-t, --target <path>", "target project directory", process.cwd())
    .option("--source", "validate the kit sources in core/ instead (for AgentSoul's own CI)", false)
    .action((o: { target: string; source: boolean }) => run("check", () => runCheck({ ...o, coreDir, version })))

program
    .command("profiles")
    .description("List stack profiles")
    .action(() =>
        run("profiles", () => {
            for (const p of loadKit(coreDir).profiles.values()) {
                console.log(`  ${p.name.padEnd(16)} ${p.description}${p.name === DEFAULT_PROFILE ? "  (default)" : ""}`)
            }
            return 0
        }),
    )

program.parse()

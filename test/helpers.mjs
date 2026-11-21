import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
export const PLUGIN = join(ROOT, "plugins", "agentsoul-ru")

export const tempDir = (prefix = "agentsoul-") => mkdtempSync(join(tmpdir(), prefix))

export function write(dir, path, content) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), content)
}

/** A writable copy of the repo sources (src/, LICENSE, package.json) for negative tests. */
export function repoCopy() {
    const dir = tempDir("agentsoul-repo-")
    for (const p of ["src", "LICENSE", "package.json"]) cpSync(join(ROOT, p), join(dir, p), { recursive: true })
    return dir
}

/** Runs the built SessionStart hook and returns { status, json, context, stderr }. */
export function runHook({ projectDir, cwd, env = {} } = {}) {
    const res = spawnSync("bash", [join(PLUGIN, "hooks", "session-start")], {
        cwd: cwd ?? projectDir ?? tmpdir(),
        env: {
            PATH: process.env.PATH,
            HOME: process.env.HOME,
            CLAUDE_PLUGIN_ROOT: PLUGIN,
            ...(projectDir !== undefined ? { CLAUDE_PROJECT_DIR: projectDir } : {}),
            ...env,
        },
        encoding: "utf8",
    })
    const json = JSON.parse(res.stdout)
    return { status: res.status, json, context: json.hookSpecificOutput.additionalContext, stderr: res.stderr }
}

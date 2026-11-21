import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"
import { existsSync, readFileSync } from "node:fs"

/** Repository root. Compiled code lives in tools/dist/, so the root is two levels up. */
export function repoRoot(): string {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
    if (!existsSync(join(root, "package.json"))) {
        throw new Error(`package.json not found at ${root}`)
    }
    return root
}

/** Version from package.json — the single source of truth for every plugin.json. */
export function packageVersion(root: string): string {
    const pkg: unknown = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
    if (pkg === null || typeof pkg !== "object" || !("version" in pkg) || typeof pkg.version !== "string") {
        throw new Error("package.json has no string `version` field")
    }
    return pkg.version
}

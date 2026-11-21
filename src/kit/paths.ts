import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"
import { existsSync, readFileSync, statSync } from "node:fs"

/**
 * Package root of the installed AgentSoul (the directory holding package.json and core/).
 * Compiled code lives in dist/kit/, so the root is two levels up.
 */
export function packageRoot(): string {
    const here = dirname(fileURLToPath(import.meta.url))
    const root = resolve(here, "..", "..")
    if (!existsSync(join(root, "package.json"))) {
        throw new Error(`AgentSoul package.json not found at ${root}`)
    }
    return root
}

/** Default kit source: `<package>/core`. Tests pass their own fixture directory instead. */
export function defaultCoreDir(): string {
    const core = join(packageRoot(), "core")
    if (!existsSync(core) || !statSync(core).isDirectory()) {
        throw new Error(`AgentSoul core/ directory not found at ${core}`)
    }
    return core
}

/** Version from package.json — the single source of truth for `--version` and the manifest. */
export function packageVersion(): string {
    const pkg: unknown = JSON.parse(readFileSync(join(packageRoot(), "package.json"), "utf8"))
    if (pkg === null || typeof pkg !== "object" || !("version" in pkg) || typeof pkg.version !== "string") {
        throw new Error("package.json has no string `version` field")
    }
    return pkg.version
}

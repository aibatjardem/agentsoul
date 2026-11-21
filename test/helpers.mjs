import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
export const CORE = join(ROOT, "core")

/** Fresh empty directory for a target project. */
export function tempDir(prefix = "agentsoul-") {
    return mkdtempSync(join(tmpdir(), prefix))
}

/** A writable copy of core/ so a test can simulate a new kit release. */
export function coreCopy() {
    const dir = join(tempDir("agentsoul-core-"), "core")
    cpSync(CORE, dir, { recursive: true })
    return dir
}

export const read = (dir, path) => readFileSync(join(dir, path), "utf8")
export const exists = (dir, path) => existsSync(join(dir, path))
export function write(dir, path, content) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), content)
}
export const append = (dir, path, text) => write(dir, path, read(dir, path) + text)

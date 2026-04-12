import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { existsSync, statSync } from "node:fs"

/**
 * Резолвит путь к core/ относительно скомпилированного dist/ CLI.
 *
 * Файл живёт в src/lib/paths.ts → dist/lib/paths.js.
 * Поэтому from `here = dist/lib`:
 *   - `../../core` = корень пакета + /core (основной путь)
 *   - `../core` = dist/core (на случай альтернативных раскладок)
 *   - `../../../core` = на уровень выше пакета (защита от перемещений)
 */
export function resolveCoreDir(): string {
    const here = dirname(fileURLToPath(import.meta.url))
    const candidates = [
        resolve(here, "..", "..", "core"),
        resolve(here, "..", "core"),
        resolve(here, "..", "..", "..", "core"),
    ]
    for (const c of candidates) {
        if (existsSync(c) && statSync(c).isDirectory()) return c
    }
    throw new Error(
        `AgentSoul core/ directory not found. Searched:\n  ${candidates.join("\n  ")}`,
    )
}

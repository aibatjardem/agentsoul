import { resolve, join } from "node:path"
import { existsSync } from "node:fs"
import { spawnSync } from "node:child_process"

interface CheckOptions {
    target: string
}

/**
 * Запускает валидатор soul-комплекта в целевом проекте.
 *
 * Ищет скрипт в таком порядке:
 *   1. <target>/scripts/check-soul.sh  (как установлен через init)
 *   2. <target>/.agentsoul/check-soul.sh (если используется альтернативный layout)
 *
 * Exit code соответствует результату валидации.
 */
export function runCheck(options: CheckOptions): number {
    const target = resolve(options.target)
    const candidates = [
        join(target, "scripts", "check-soul.sh"),
        join(target, ".agentsoul", "check-soul.sh"),
    ]

    const script = candidates.find((p) => existsSync(p))
    if (script === undefined) {
        console.error(`❌ check-soul.sh not found. Searched:\n  ${candidates.join("\n  ")}`)
        console.error("")
        console.error("Did you run `agentsoul init` first?")
        return 1
    }

    console.log(`AgentSoul check → ${target}`)
    console.log(`  script: ${script}`)
    console.log("")

    const result = spawnSync("bash", [script], {
        cwd: target,
        stdio: "inherit",
    })

    return result.status ?? 1
}

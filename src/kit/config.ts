import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

/** Project-owned settings in `.soul/config.json`. Never overwritten by the CLI. */
export interface SoulConfig {
    readonly profile: string
    readonly models: {
        /** Model for every subagent unless overridden per agent; null keeps the kit defaults. */
        readonly default: string | null
        readonly agents: Readonly<Record<string, string>>
    }
}

export const CONFIG_PATH = ".soul/config.json"

/**
 * Accepted `model` values for subagent frontmatter: Claude Code aliases,
 * `inherit` (use the main session's model), or a full model id.
 */
export function isValidModel(value: string): boolean {
    return /^(inherit|opus|sonnet|haiku|fable)$/.test(value) || /^claude-[a-z0-9.-]+$/.test(value)
}

/** Fallback when a project has no config.json yet (e.g. installed by AgentSoul 0.1). */
export function defaultConfig(profile: string): SoulConfig {
    return { profile, models: { default: null, agents: {} } }
}

/**
 * Reads and validates `.soul/config.json`. Returns null when the file does not exist.
 *
 * @throws Error with a precise message when the file is malformed.
 */
export function readConfig(target: string): SoulConfig | null {
    const path = join(target, CONFIG_PATH)
    if (!existsSync(path)) return null
    let raw: unknown
    try {
        raw = JSON.parse(readFileSync(path, "utf8"))
    } catch (err) {
        throw new Error(`${CONFIG_PATH}: invalid JSON (${(err as Error).message})`)
    }
    return parseConfig(raw)
}

/** Validates an already-parsed config object. */
export function parseConfig(raw: unknown): SoulConfig {
    if (!isRecord(raw)) throw new Error(`${CONFIG_PATH}: expected an object`)
    const profile = raw["profile"]
    if (typeof profile !== "string" || profile === "") {
        throw new Error(`${CONFIG_PATH}: "profile" must be a non-empty string`)
    }
    const models = raw["models"] ?? {}
    if (!isRecord(models)) throw new Error(`${CONFIG_PATH}: "models" must be an object`)

    const def = models["default"] ?? null
    if (def !== null && (typeof def !== "string" || !isValidModel(def))) {
        throw new Error(`${CONFIG_PATH}: models.default "${String(def)}" is not a valid model`)
    }
    const agentsRaw = models["agents"] ?? {}
    if (!isRecord(agentsRaw)) throw new Error(`${CONFIG_PATH}: "models.agents" must be an object`)
    const agents: Record<string, string> = {}
    for (const [name, model] of Object.entries(agentsRaw)) {
        if (typeof model !== "string" || !isValidModel(model)) {
            throw new Error(`${CONFIG_PATH}: models.agents.${name} "${String(model)}" is not a valid model`)
        }
        agents[name] = model
    }
    return { profile, models: { default: def, agents } }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value)
}

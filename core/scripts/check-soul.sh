#!/usr/bin/env bash
# check-soul.sh — валидация консистентности soul-комплекта
# Проверяет:
#   1. YAML frontmatter всех субагентов (обязательные поля, name == filename)
#   2. Соответствие индекса в .soul/agents.md реальным файлам .claude/agents/
#   3. Битые кросс-ссылки на субагентов в любом файле .soul/ и .claude/agents/
#   4. Наличие baseline-файлов, подключённых в CLAUDE.md
#
# Exit code: 0 — всё чисто, 1 — есть проблемы.

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

AGENTS_DIR=".claude/agents"
SOUL_DIR=".soul"
INDEX=".soul/agents.md"
CLAUDE_MD="CLAUDE.md"

errors=0
warnings=0

section() { echo ""; echo "=== $1 ==="; }
fail() { echo "  ❌ $1"; errors=$((errors + 1)); }
warn() { echo "  ⚠  $1"; warnings=$((warnings + 1)); }
ok()   { echo "  ✅ $1"; }

# --- 1. baseline files exist ---
section "Baseline files (referenced by CLAUDE.md)"
if [ ! -f "$CLAUDE_MD" ]; then
  fail "CLAUDE.md missing"
else
  imported=$(grep -oE '@\.soul/[a-z_-]+\.md' "$CLAUDE_MD" | sed 's/^@//')
  for f in $imported; do
    if [ -f "$f" ]; then
      ok "$f"
    else
      fail "$f imported in CLAUDE.md but does not exist"
    fi
  done
fi

# --- 2. YAML frontmatter ---
section "YAML frontmatter in .claude/agents/"
if ! command -v python3 >/dev/null; then
  warn "python3 not found, skipping YAML validation"
else
  python3 - "$AGENTS_DIR" <<'PY' || errors=$((errors + 1))
import os, re, sys
try:
    import yaml
except ImportError:
    print("  ⚠  pyyaml not installed, skipping YAML validation")
    sys.exit(0)

d = sys.argv[1]
if not os.path.isdir(d):
    print(f"  ❌ {d} not a directory")
    sys.exit(1)

errs = 0
for f in sorted(os.listdir(d)):
    if not f.endswith('.md'): continue
    path = os.path.join(d, f)
    with open(path) as fh:
        content = fh.read()
    m = re.match(r'^---\n(.*?)\n---\n', content, re.DOTALL)
    if not m:
        print(f"  ❌ {f}: no frontmatter")
        errs += 1
        continue
    try:
        data = yaml.safe_load(m.group(1))
    except yaml.YAMLError as e:
        print(f"  ❌ {f}: YAML error: {e}")
        errs += 1
        continue
    if not isinstance(data, dict):
        print(f"  ❌ {f}: frontmatter not a dict")
        errs += 1
        continue
    for k in ('name', 'description', 'tools'):
        if k not in data:
            print(f"  ❌ {f}: missing field '{k}'")
            errs += 1
    expected_name = f.replace('.md', '')
    if data.get('name') != expected_name:
        print(f"  ❌ {f}: name field '{data.get('name')}' != filename '{expected_name}'")
        errs += 1
    if not isinstance(data.get('tools'), list):
        print(f"  ⚠  {f}: tools is not a YAML list (got {type(data.get('tools')).__name__})")

print(f"  {'✅' if errs == 0 else '❌'} checked {sum(1 for f in os.listdir(d) if f.endswith('.md'))} agents, {errs} errors")
sys.exit(1 if errs > 0 else 0)
PY
fi

# --- 3. Index vs reality ---
section "Index ($INDEX) vs reality ($AGENTS_DIR)"
actual=$(ls "$AGENTS_DIR"/*.md 2>/dev/null | xargs -n1 basename 2>/dev/null | sed 's/\.md$//' | sort -u)
if [ -f "$INDEX" ]; then
  indexed=$(grep -oE '`[a-z][a-z0-9-]+`' "$INDEX" | tr -d '`' | sort -u)
else
  fail "$INDEX missing"
  indexed=""
fi

# файлы, которых нет в индексе
for f in $actual; do
  if ! echo "$indexed" | grep -qx "$f"; then
    warn "$f exists but not mentioned in $INDEX"
  fi
done

# упоминания в индексе, которых нет среди файлов
known_non_agents="help status agents architecture-guide conventions-guide infrastructure-guide stack-reference"
for f in $indexed; do
  if ! echo "$actual" | grep -qx "$f"; then
    # отфильтруем заведомо неагентные backticked строки (если попали)
    case " $known_non_agents " in
      *" $f "*) continue ;;
    esac
    # эвристика: если содержит дефис — вероятно агент
    if echo "$f" | grep -q '-'; then
      warn "$INDEX mentions '$f' but no such agent file exists"
    fi
  fi
done

ok "index check done"

# --- 4. Cross-references in .soul/ and .claude/agents/ ---
section "Cross-references to subagents"
# найти все упоминания вида `<name>` которые выглядят как имена агентов
# (имеют суффикс из типичных ролей: -architect, -specialist, etc.)
mentioned=$(grep -rhoE '`[a-z][a-z0-9-]*(-architect|-specialist|-expert|-designer|-keeper|-initializer|-manager|-planner|-guide|-reference|-reviewer|-optimizer)`' "$SOUL_DIR" "$AGENTS_DIR" 2>/dev/null | tr -d '`' | sort -u)

bad=0
for m in $mentioned; do
  if ! echo "$actual" | grep -qx "$m"; then
    warn "reference to '$m' found but no agent file exists"
    bad=$((bad + 1))
  fi
done
if [ "$bad" -eq 0 ]; then
  ok "all subagent references resolve to existing files"
fi

# --- summary ---
section "Summary"
echo "  errors:   $errors"
echo "  warnings: $warnings"
if [ "$errors" -eq 0 ]; then
  echo ""
  echo "  ✅ soul-kit is consistent"
  exit 0
else
  echo ""
  echo "  ❌ soul-kit has $errors error(s) — fix before committing"
  exit 1
fi

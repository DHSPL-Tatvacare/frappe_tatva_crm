#!/usr/bin/env bash
# Upstream-drift guard for the lean fork. Fails LOUDLY (exit 1) if a cherry-pick / upstream merge
# silently dropped one of our additive extension points, so a broken board can never ship unnoticed.
# Run before every build:  bash scripts/check-tatva-hooks.sh
set -u
root="$(cd "$(dirname "$0")/.." && pwd)/frontend/src"
fail=0
need() { # need <file> <grep-pattern> <human description>
  if ! grep -q -- "$2" "$root/$1" 2>/dev/null; then
    echo "✗ MISSING: $3  ($1)"
    fail=1
  fi
}

# Upstream files we touched (must keep their // TATVA: seams)
need "components/Activities/Activities.vue"      "import TatvaTasks"              "Activities.vue imports TatvaTasks"
need "components/Activities/Activities.vue"      "<TatvaTasks"                    "Activities.vue mounts the board for leads"
need "components/Activities/Activities.vue"      "ActivityAuditEntry"             "Activities.vue mounts the per-lead audit row renderer"
need "components/Activities/ActivityHeader.vue"  "__tcLogActivity"               "ActivityHeader Log Activity action"
need "pages/Tasks.vue"                           "TatvaTaskModal"                "Tasks.vue imports the config modal"
need "pages/Tasks.vue"                           "activity.api.task_detail"      "Tasks.vue showTask intercept"
need "pages/Lead.vue"                            "<TatvaStagePill"               "Lead.vue mounts the grain-scoped stage pill"
need "pages/MobileLead.vue"                      "<TatvaStagePill"               "MobileLead.vue mounts the grain-scoped stage pill"

# WhatsApp native promotion (retires the 4 tatva_connect WhatsApp form-script DOM hacks)
need "composables/whatsapp.js"                   "whatsappRouted"                "whatsapp.js grain-routed WhatsApp gate"
need "components/Activities/ActivityHeader.vue"  "whatsappActions"               "ActivityHeader WhatsApp split button"
need "components/Activities/Activities.vue"      "TatvaWhatsAppTemplate"         "Activities.vue mounts our Send-Template dialog"
need "components/Activities/Activities.vue"      "refreshHistory"                "Activities.vue Refresh History handler"
need "components/Activities/WhatsAppBox.vue"     "TatvaWhatsAppWindowNotice"     "WhatsAppBox 24h window-closed notice"
need "components/Activities/WhatsAppArea.vue"    "failedReasons"                 "WhatsAppArea failed-reason tooltip"
need "pages/Lead.vue"                            "whatsappRouted"                "Lead.vue grain-routed WhatsApp tab gate"
need "pages/MobileLead.vue"                      "whatsappRouted"                "MobileLead.vue grain-routed WhatsApp tab gate"

# Our own files must exist
for f in tatva/TatvaTasks.vue tatva/TatvaTaskModal.vue tatva/TatvaMiniMap.vue tatva/TatvaStagePill.vue tatva/ActivityAuditEntry.vue tatva/TatvaWhatsAppTemplate.vue tatva/TatvaWhatsAppWindowNotice.vue; do
  [ -f "$root/$f" ] || { echo "✗ MISSING our file: $f"; fail=1; }
done

if [ "$fail" -ne 0 ]; then
  echo "TATVA hook check FAILED — an extension point was dropped by an upstream merge. Re-apply it (see CUSTOMIZATIONS.md) before building."
  exit 1
fi
echo "✓ TATVA hooks intact."

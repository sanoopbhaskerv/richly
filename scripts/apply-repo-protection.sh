#!/usr/bin/env bash
# Applies Richly's repository protection rulesets via the GitHub CLI.
#
# What it enforces:
#   1. Branch ruleset "protect-main":
#      - No direct pushes: every change to main must come through a pull
#        request with 1 approving review from a code owner (.github/CODEOWNERS).
#      - Required status checks: the CI quality + browser jobs must be green
#        and the branch must be up to date with main.
#      - Force pushes and branch deletion are blocked.
#   2. Tag ruleset "protect-release-tags":
#      - Only repository admins can create, move, or delete v* tags — which is
#        what triggers the Release (npm publish) workflow.
#
# Repository admins bypass the branch ruleset so a solo maintainer can still
# merge (GitHub forbids approving your own PR). Remove the bypass_actors block
# once there is a second maintainer.
#
# Requirements: gh CLI authenticated with admin access to the repository.
# Usage: ./scripts/apply-repo-protection.sh [owner/repo]

set -euo pipefail

REPO="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
echo "Applying protection rulesets to ${REPO}…"

# --- 1. Branch ruleset: main goes through pull requests + green CI ----------
gh api "repos/${REPO}/rulesets" --method POST --input - <<'JSON'
{
  "name": "protect-main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] }
  },
  "bypass_actors": [
    { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" }
  ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "require_code_owner_review": true,
        "dismiss_stale_reviews_on_push": true,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["squash", "merge"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "quality (18)" },
          { "context": "quality (20)" },
          { "context": "browser (chromium)" },
          { "context": "browser (firefox)" },
          { "context": "browser (webkit)" }
        ]
      }
    }
  ]
}
JSON
echo "✓ branch ruleset protect-main"

# --- 2. Tag ruleset: only admins can touch release tags ---------------------
gh api "repos/${REPO}/rulesets" --method POST --input - <<'JSON'
{
  "name": "protect-release-tags",
  "target": "tag",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "include": ["refs/tags/v*"], "exclude": [] }
  },
  "bypass_actors": [
    { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" }
  ],
  "rules": [
    { "type": "creation" },
    { "type": "update" },
    { "type": "deletion" }
  ]
}
JSON
echo "✓ tag ruleset protect-release-tags"

cat <<'EOF'

Done. Two settings cannot be scripted and must be confirmed in the UI:
  1. Settings → Environments → npm → add yourself under "Required reviewers"
     (this makes every npm publish wait for explicit approval).
  2. Settings → Actions → General → Workflow permissions → "Read repository
     contents" as default, and disable "Allow GitHub Actions to create and
     approve pull requests".
EOF

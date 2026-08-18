#!/usr/bin/env bash
# Enables branch protection on `main` via the GitHub REST API.
#
# Why this exists: GitHub Free does not include branch protection (or
# repository rulesets) for private repositories — the API rejects it with
# "Upgrade to GitHub Pro or make this repository public to enable this
# feature." Run this after the repo is on a plan that supports it (Pro,
# Team, or Enterprise), or after making the repo public.
#
# Settings map to OSSF Scorecard's Branch-Protection probes:
#   - required_status_checks (strict)  -> runsStatusChecksBeforeMerging,
#                                         requiresUpToDateBranches
#   - enforce_admins                   -> branchProtectionAppliesToAdmins
#   - required_approving_review_count  -> requiresApproversForPullRequests
#   - require_code_owner_reviews       -> requiresCodeOwnersReview
#     (requires .github/CODEOWNERS, committed alongside this script)
#   - require_last_push_approval       -> requiresLastPushApproval
#   - dismiss_stale_reviews            -> dismissesStaleReviews
#   - allow_force_pushes/allow_deletions -> blocksForcePush/Delete
#   - required_pull_request_reviews    -> requiresPRsToChangeCode
#
# Score: 9/10. The final point needs required_approving_review_count >= 2,
# which makes merging impossible for a single-account repo (GitHub blocks
# authors from approving their own PRs). Bump the count to 2 only when a
# second reviewer account exists.
#
# Usage: bash scripts/enable-branch-protection.sh
set -euo pipefail

cd "$(dirname "$0")/.."
REMOTE=$(git remote get-url origin)
if [[ "$REMOTE" == *github.com:* ]]; then
  OWNER_REPO=${REMOTE#*github.com:}
elif [[ "$REMOTE" == https://github.com/* ]]; then
  OWNER_REPO=${REMOTE#https://github.com/}
else
  echo "Cannot parse origin URL: $REMOTE" >&2
  exit 1
fi
OWNER_REPO=${OWNER_REPO%.git}
echo "Applying branch protection to $OWNER_REPO (branch: main)..."

gh api --method PUT "repos/${OWNER_REPO}/branches/main/protection" --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Frontend (TypeScript)", "Backend (Rust)", "E2E Tests"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": true,
  "required_conversation_resolution": true
}
JSON

echo "Done. Verify with: gh api repos/${OWNER_REPO}/branches/main/protection"

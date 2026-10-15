---
source: "requirement/route01-rules-and-scoring.md"
retrieved: 2026-10-15T00:37:39Z
converter: copy
---

# Route 01 Rules and Scoring

## Seven destinations
1. Bãi biển Non Nước (`non_nuoc`)
2. Bãi Sơn Thủy (`son_thuy`)
3. Bãi Phạm Văn Đồng (`pham_van_dong`)
4. Bãi Mân Thái (`man_thai`)
5. Hòn Sụp (`hon_sup`)
6. Cù Lao Chàm (`cu_lao_cham`)
7. Lý Sơn (`ly_son`, mandatory shared finish)

## Start selection
Each team selects one of the first six destinations at season start. Selection is allowed before the configured deadline, then immutable except an audited exceptional correction. Lý Sơn cannot be a start.

## Normalized progress
`progress_pct = min(100, eligible_progress_units / route_length_units * 100)`
- Route baseline is configured per start and locked/versioned for the season.
- Only verified activities contribute.
- Use fixed-precision/integer units; round for display only.
- The server is authoritative. Ignore client-supplied progress/finish values.
- At 100%, emit one idempotent finish event.
- Reversal/revocation must create ledger reversal and follow explicit completion correction policy.

## Separate score domains
- verified swim distance
- eligible route contribution
- normalized route progress
- personal XP
- tournament leaderboard points
- consistency/participation
Do not silently substitute one metric for another. Label leaderboard criteria clearly.

## Activity status
Pending, rejected, duplicate, disputed and revoked activities do not contribute while in those states. Verification lifecycle and current validated ingestion path must be reused rather than replaced.

## Safety
No public precise GPS. No game prompts encouraging unsafe distance, pace, night swimming or solo open-water swimming. Map is illustrative, not a real-world route recommendation.

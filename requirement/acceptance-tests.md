# Acceptance Test Plan

## Accounts
1. Successful signup and verification.
2. Login/logout/password reset paths.
3. Suspended/deleted account cannot use protected endpoints.
4. Profile privacy defaults do not expose email or precise GPS.
5. RBAC prevents player from invoking organizer/admin operations.

## Tournament lifecycle
6. Valid tournament draft can be created.
7. Invalid date windows and missing required fields are rejected.
8. Only authorized organizer can publish/edit.
9. Tournament visibility and join policy are enforced.
10. Capacity/eligibility rules are enforced under concurrent join requests.
11. Active tournament config changes are versioned/audited or blocked.

## Teams
12. Eligible player can create a team.
13. Invitation tokens expire and cannot be reused improperly.
14. Join request approval/rejection follows tournament policy.
15. Duplicate team membership constraints hold.
16. Captain handover and member removal are audited.

## Route 01
17. Six start destinations are selectable; Lý Sơn is not.
18. Start selection locks at configured deadline.
19. Same selection request is idempotent; different post-lock selection fails.
20. Every team shares Lý Sơn as finish.
21. Seven destinations render in correct order and spelling.
22. Route baselines are immutable after season start except audited override/versioning.
23. Progress formula clamps to 100 and retains calculation precision.

## Activities and scoring
24. Pending/unverified activities add no progress.
25. Verified activity contributes once only.
26. Duplicate submission is detected.
27. Revocation/correction reverses ledger contribution with audit.
28. Client cannot set score/progress/finish.
29. Raw distance and normalized progress are displayed separately.
30. Existing validated ingestion and scoring regression tests pass.

## UI and assets
31. All primary flows work on mobile and desktop.
32. Loading/empty/error/offline states render.
33. Missing art uses fallback and does not crash.
34. Keyboard navigation and visible focus work.
35. UI text remains accessible and is not baked into map art.
36. Contact sheet and manifest match actual exported assets.

## Privacy/safety/operations
37. Public endpoints do not return precise GPS.
38. Analytics events exclude unnecessary personal or GPS data.
39. Admin override requires reason and records before/after values.
40. No game copy encourages dangerous swimming.
41. Tournament close/archive preserves audit history.
42. Backup, migration rollback and incident procedures are documented.


## Player profile management
43. Player can view and update permitted profile fields.
44. Invalid display name/bio/handle values are rejected with useful validation errors.
45. Public profile response respects every privacy setting and omits email by default.
46. Verified stats cannot be edited by the player and match the scoring source.
47. Activity history is paginated and scoped to the authenticated player.
48. Strava sign-in status is distinct from activity-import authorization status.
49. Disconnecting Strava cannot lock the player out when it is the only login method unless a recovery method is established first.
50. Unsaved-change, loading, empty, offline and API-error states are handled.
51. Account export/deletion requests require appropriate confirmation and follow retention policy.

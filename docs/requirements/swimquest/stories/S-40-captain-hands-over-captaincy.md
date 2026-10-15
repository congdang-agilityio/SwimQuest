# S-40: Captain hands over captaincy

- **Priority:** P1
- **Covers:** FR-35, FR-55 · **Decisions:** Q-46
- **Depends on stories:** S-08

## User story
As a team captain, I want to hand over captaincy to another member, so that the team keeps a leader when I cannot lead.

## Acceptance criteria
1. **Way in**
   - Given I am captain
   - When I open My Team and choose a member
   - Then I see "Make captain"
2. **Handover**
   - Given I choose "Make captain" for a member and confirm
   - When the handover completes
   - Then that member is captain and I am a normal member
3. **New captain's powers**
   - Given the handover completed
   - When the new captain opens My Team
   - Then they see the captain tools and I no longer do
4. **Organizer override**
   - Given a handover happened
   - When the organizer appoints someone else (S-08)
   - Then the organizer's choice wins
5. **Audited**
   - Given a handover happened
   - When the audit trail is checked
   - Then it records old and new captain, who did it and when

## Out of scope
- Organizer appointment (S-08).

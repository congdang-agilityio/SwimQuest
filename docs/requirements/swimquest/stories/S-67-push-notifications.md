# S-67: Push notifications on my device

- **Priority:** P1
- **Covers:** FR-53, FR-17 · **Decisions:** Q-17
- **Depends on stories:** S-66, S-73

## User story
As a player, I want push notifications on my phone, so that I hear about my swims and team without opening the app.

## Acceptance criteria
1. **Turn on per device**
   - Given I am on Profile → Notifications on a device that supports push
   - When I switch "Push on this device" on and allow it in the browser prompt
   - Then this device receives push notifications
2. **Same events as in-app**
   - Given push is on for my device
   - When an event from S-66 happens to me
   - Then I get a push message in my chosen language, which opens the related page when tapped
3. **Turn off per device**
   - Given push is on for this device
   - When I switch it off
   - Then this device stops receiving push; my other devices are unaffected
4. **Unsupported device**
   - Given my browser cannot receive push, or the app is not installed on an iPhone
   - When I open Notifications
   - Then I see why push is unavailable and how to enable it (for example "Add to Home Screen" on iOS 16.4 or later)
5. **Permission denied**
   - Given I denied the browser permission
   - When I look at the push setting
   - Then it shows as blocked with a hint how to allow it in the browser settings

## Out of scope
- Category preferences (S-68).

## Notes
- R-16 (Zalo in-app browser), R-17 (iPhone).

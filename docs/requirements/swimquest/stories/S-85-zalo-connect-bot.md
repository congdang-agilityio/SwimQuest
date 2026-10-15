# S-85: Zalo: connect the organizer's bot and group

- **Priority:** P2
- **Covers:** FR-83, NFR-19 · **Decisions:** Q-17, Q-54
- **Depends on stories:** S-65

## User story
As a tournament organizer, I want to connect my own Zalo bot to my tournament's Zalo group, so that the group gets announcements automatically.

## Acceptance criteria
1. **Way in and steps**
   - Given I am the organizer, creating or editing my tournament
   - When I open "Zalo group" in settings (or the organizer console)
   - Then I see the steps: create a Zalo bot, paste its key here, add the bot to the group, mention the bot in the group
2. **Key checked and protected**
   - Given I paste a bot key and save
   - When it is checked
   - Then an invalid key is rejected with a message; a valid key is saved and is never shown back in full, never sent to players' browsers and never logged
3. **Group linked by a mention**
   - Given the bot is in my Zalo group and the key is saved
   - When someone mentions the bot in the group for the first time
   - Then the group is linked to my tournament and the settings show it as connected
4. **Introduction message**
   - Given the group was just linked
   - When the link is made
   - Then the bot posts the tournament introduction in Vietnamese (dates, rules, invite link)
5. **One bot, several tournaments**
   - Given I use the same bot on another of my tournaments
   - When I save it there
   - Then that tournament posts to the group the bot already posts to; removing the bot from one tournament does not affect the others

## Out of scope
- Other message kinds (S-86 to S-88); switches and delivery problems (S-89).

## Notes
- Works as in RunnerWars (SRC-16). The bot only posts, never replies.

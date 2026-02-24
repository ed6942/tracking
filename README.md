# PSE System (Discord User-Install App)

Commands (global):
- `/pse` — shows Roblox group members online/in-game, plus game name + join link when available.
- `/auth <userid>` — owner only: grants Unlimited Access.
- `/unauth <userid>` — owner only: removes Unlimited Access.
- `/blacklist <userid> [reason]` — owner only: blocks a user from using `/pse`.
- `/unblacklist <userid>` — owner only: removes blacklist.
- `/authinfo` — owner only: shows Blacklisted / Unlimited / Trial sections (clickable mentions).

Rules:
- Everyone gets **3** free `/pse` tries automatically.
- Unlimited users have no limit.
- No ephemeral replies: all responses are public in the chat.

Roblox group: `34441815`

## Deploy (Railway)
1) Push to GitHub
2) Deploy on Railway
3) Set Variables:
- DISCORD_TOKEN
- DISCORD_CLIENT_ID=1475223666232000522
- OWNER_DISCORD_ID=1147207597414428774
- ROBLOX_GROUP_ID=34441815
- INSTALL_URL=https://discord.com/oauth2/authorize?client_id=1475223666232000522

## Important Discord setting
In the Developer Portal, make sure **"Requires OAuth2 Code Grant"** is OFF, or installs will fail.

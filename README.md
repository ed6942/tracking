# PSE Roblox Presence Discord App

Global slash commands:
- `/pse` — shows Roblox group members who are online/in-game, plus game + join link.
- `/auth <userid>` — (owner only) grants **Unlimited Access** to a Discord user ID.
- `/unauth <userid>` — (owner only) removes unlimited access (keeps trial record).
- `/authinfo` — (owner only) shows authorized users list.

Access model:
- Everyone gets a **10-use trial** automatically the first time they run `/pse`.
- Trial decrements on each `/pse`.
- When trial hits 0, `/pse` is blocked and tells them to DM you.
- If you run `/auth <userid>`, that user gets **Unlimited Access** (no decrement).

Roblox group: `34441815`

---

## Deploy on Railway

1. Push this repo to GitHub.
2. Create a new Railway project → Deploy from GitHub repo.
3. Set variables in Railway:
   - `DISCORD_TOKEN` (your bot token)
   - `DISCORD_CLIENT_ID` (already set in `.env.example`)
   - `OWNER_DISCORD_ID` (your Discord user ID)
   - `ROBLOX_GROUP_ID` (defaults to 34441815)
   - `INSTALL_URL` (defaults to your provided install link)
4. Deploy.

On first boot the bot will register global slash commands.
> Global command updates can take a few minutes to appear in Discord.

---

## Notes about storage

Trial/unlimited data is stored in `data/auth.json` on disk.
- This survives normal restarts **as long as the container filesystem is preserved**.
- If you redeploy from scratch, you may lose the file. If you want guaranteed persistence, ask and we can switch to a managed DB (e.g., Railway Postgres).

---

## Troubleshooting

- If commands don’t show up, wait a few minutes (global propagation) then restart once.
- Make sure your app has `applications.commands` enabled in the Install settings.

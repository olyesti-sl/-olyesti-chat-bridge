# Olyesti ⇄ Second Life chat bridge

This Node.js Express server provides the web half of the two-way Olyesti chat relay.

## Deploy

1. Set the environment variable `RELAY_SECRET` to the exact secret in the LSL script.
2. Run `npm install`, then `npm start`.
3. Host the service at a public HTTPS address, for example `https://chat.olyesti.com`.
4. Put that address in the script's `URL` setting.

## Endpoints

- `POST /api/secondlife/incoming` accepts a JSON body with `speaker`, `text`, and optional `relay`.
- `POST /api/secondlife/outgoing` returns up to ten pending web messages as `{ "messages": [...] }`.
- Both require the `X-olyesti-secret` header to match `RELAY_SECRET`.

## Notes

- The chat UI at `/` is intentionally simple and accepts a display name. Add Shopify customer authentication and moderation before a public launch.
- The LSL relay hears local public chat within its range, not group IM, private IM, or all-region chat.
- Keep the relay object no-copy. Rotate `RELAY_SECRET` if it is ever exposed.

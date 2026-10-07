# Authentication and profiles (Phase 4)

## How login works
1. The browser talks to **Supabase Auth** directly for sign-up, login, logout and password reset.
   Passwords never touch our API or database.
2. Supabase returns an access token (a signed JWT). The browser sends it to our API as
   `Authorization: Bearer <token>`.
3. The API verifies the token: asymmetric tokens locally using Supabase's public keys (JWKS);
   older shared-secret (HS256) tokens by asking Supabase Auth (`/auth/v1/user`).
   Checked against Supabase docs on 2026-10-04.
4. On the first call, the API creates the `app_user` row (id = Supabase user id) and records the
   consents ticked at sign-up (`consent_ledger`, taken from sign-up metadata).

## Key decisions
| Decision | Reason |
|---|---|
| API is the only gatekeeper to our tables | Browser never queries the database; RLS deny-by-default on Supabase |
| Publishable key in browser, secret key only on server | Secret key can delete users; anything in the browser is public |
| `deleted_account` tombstone (random id only) | A deleted user's token stays valid up to ~1 hour; without this it would re-create the account |
| Same message for wrong password / unknown email | Prevents probing which emails have accounts |
| Reset-password always says "if an account exists" | Same reason |
| Zod schema mirrors DB CHECK constraints, `.strict()` | Unknown fields (e.g. `isAdmin`) are rejected |
| SQL column names come from a fixed whitelist | No user input ever becomes SQL text |
| Errors: friendly message to user, stack only in server log | No information leaks |

## Known limits (honest list)
- 18+ and consent are self-declared; the server cannot verify them.
- Account deletion: if removing the Supabase login fails after the data is deleted, the API returns
  a clear error and logs it (data is already gone; login can be removed manually).
- Photo files are not deleted yet because photo storage arrives in Phase 9 (marked TODO in code).
- Rate limiting is per IP, 120 requests/minute on `/api`. Login attempts are limited by Supabase itself.
- Supabase's built-in email sender is for testing and heavily limited [VERIFY]; production needs custom SMTP.

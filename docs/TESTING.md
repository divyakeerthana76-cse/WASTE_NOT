# WasteNot Testing Plan

Use Postman for API testing. Replace the base URL with the deployed Render URL after deployment.

## Test setup

1. Run `database/schema.sql`.
2. Run `database/seed.sql`.
3. Start with `npm start`.
4. Login with the seeded demo account or register a new user.
5. Copy the returned token into Postman's Bearer Authorization setting for protected requests.

## API checklist

| # | Test | Expected result |
|---|---|---|
| 1 | `GET /api/health` | `200`, API and DB connected |
| 2 | `POST /api/users` | `201`, user created without exposing password |
| 3 | Duplicate registration | `409` |
| 4 | `POST /api/users/login` | `200`, token returned |
| 5 | Wrong login password | `401` |
| 6 | `POST /api/surplus` | `201`, listing stored in PostgreSQL |
| 7 | Missing food name | `400` |
| 8 | Negative quantity | `400` |
| 9 | `GET /api/surplus` | Real PostgreSQL listings returned |
| 10 | Filter `?location=Chennai` | Only matching location |
| 11 | Filter `?status=AVAILABLE` | Only available listings |
| 12 | `GET /api/surplus/:id` | Specific listing returned |
| 13 | `PUT /api/surplus/:id` | Own eligible listing updated |
| 14 | Edit another user's listing | `403` |
| 15 | `DELETE /api/surplus/:id` | Own eligible listing deleted |
| 16 | `POST /api/claims` PERSONAL | Claim created; surplus becomes `CLAIMED` |
| 17 | Claim same surplus again | `409` |
| 18 | Claim quantity above listing | `400` |
| 19 | Claim expired listing | `409`; listing becomes `EXPIRED` |
| 20 | `GET /api/organizations?location=Chennai` | Matching organizations returned |
| 21 | REDISTRIBUTION with matching org | Claim created; status becomes `REDISTRIBUTED` |
| 22 | REDISTRIBUTION with wrong location | `400` |
| 23 | `GET /api/claims` | User's relevant claims returned |
| 24 | `GET /api/dashboard` | Statistics calculated from DB |
| 25 | Confirm dashboard metric | Sum of completed claim quantities |

## Frontend testing

- Register a user from the UI.
- Login and verify the user name appears in the header.
- Add a surplus listing.
- Open Find Food and verify the listing is shown.
- Claim it personally and verify it disappears from available results.
- Add another listing and redistribute it to a same-location organization.
- Open Claims and verify the completed action appears.
- Edit an eligible listing from My Surplus.
- Delete an eligible listing.
- Try invalid form values and verify clear error feedback.
- Resize the browser to a mobile width and verify the layout remains usable.
- Refresh after login and verify the local authentication state restores the application.
- Logout and verify the login screen returns.

## Important correctness checks

- No password is returned by user APIs.
- No dashboard values are hard-coded.
- Every important UI action calls a real API.
- Claim and status update happen in one PostgreSQL transaction.
- SQL uses parameters.
- Expired food cannot be claimed.
- Completed listings cannot be modified or claimed again.
- Organization redistribution requires an existing same-location organization.

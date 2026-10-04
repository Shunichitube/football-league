# Multiplayer notifications

The browser sends committed actions over the existing POST API. Auction bids and
passes are sent immediately; lineup, training and result acknowledgements are
sent only when confirmed. Request IDs and persisted pending requests retain the
existing retry semantics.

Normal operation makes no scheduled HTTP state requests. Each participant opens
an authenticated, same-origin WebSocket at `/api/rooms/:roomId/events`. The token
is supplied in a WebSocket subprotocol, never in the URL. The server negotiates
`room-v1` and sends a personalized snapshot on connection, followed by revisioned
patches when authoritative state changes. Private inputs and hidden player data
are filtered by the same `publicRoom` function used by HTTP responses.

The Durable Object uses hibernatable sockets with only the participant ID in
their attachments. Mutations are saved before broadcasting. Auction alarms save
and broadcast CPU actions, deadline extensions, settlement and lot transitions,
even when no browser makes a state request. The existing local auction clock
renders remaining time from the authoritative deadline and server time.

Disconnects use backoff reconnection; reconnects receive the latest snapshot.
Returning to a visible tab or regaining network connectivity reconnects too.
Missing patch revisions trigger a single HTTP state recovery; duplicate or older
revisions are ignored. There is no HTTP polling fallback. An unavailable
notification connection is shown through the existing reconnect UI.

All human lineup confirmations now simulate the season immediately and enter
`season-result`; a separate league-start confirmation is unnecessary. Existing
stored `season-ready` rooms retain their confirmation handler for compatibility.
Each client's adapter filters results to its own club and retains the existing
live-transition season animation. Room storage keys and save formats are unchanged.

Validation: notification/reconnect/patch tests, HTTP multiplayer flow including a
lost final-lineup response and idempotent retry, and auction rule/alarm tests.
The local Cloudflare runtime was also exercised for authenticated snapshots,
mutation broadcasts, origin/token rejection and automatic auction notifications
without HTTP state polling. No production deployment is part of this change.

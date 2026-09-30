# TimeTree outbound production runbook

Home Dashboard is the source of truth. Organizer writes create or replace one `TimeTreeOutboundOperation` in the same SQLite transaction. The dashboard worker owns candidate selection, leases, retry state, deletion tombstones and verified sync metadata. `home-billing-api` owns the authenticated Playwright session and remote inspection and never writes the Dashboard database.

## State machine

- `pending -> processing -> succeeded`: the adapter verified calendar, ownership marker, event identity and the complete canonical payload.
- `processing -> retry_wait`: failure was proven to occur before a remote write control was clicked. Backoff is 1, 5, 15, then 60 minutes.
- uncertain CREATE/UPDATE/DELETE after a write click becomes `reconcile_required`; it is never sent through the create path again.
- reconciliation performs no remote write. One exact remote result may complete the operation; zero or ambiguous CREATE/UPDATE candidates remain unresolved; changed remote content becomes `conflict`.
- authentication and selector failures become `failed` for human review.

The verified payload JSON and hash are retained as the remote base. UPDATE and DELETE require the stored event ID, canonical URL, exact marker and base payload. A changed remote hash is a conflict. Physical Organizer deletion leaves the operation row as a tombstone.

## Safety gates

A non-dry run requires all of the following:

1. CLI `--confirm WRITE_TIMETREE`.
2. `TIMETREE_OUTBOUND_WRITES_ENABLED=true` in Home Dashboard.
3. exactly one enabled mapping with `outboundEnabledAt`, `calendarName`, `calendarId`, and canonical `calendarUrl`.
4. adapter status `ready=true` with an exact match for all three calendar identity fields.
5. `--limit 1`.
6. adapter-side `TIMETREE_ADAPTER_WRITES_ENABLED=true` plus the independent confirmation header.

The mapping identity must be bootstrapped manually from the already read-only-verified adapter status and reviewed before setting `outboundEnabledAt`. Environment variables alone never select a calendar.

## Isolated verification

Use a copy or temporary SQLite database. Apply migrations through `20260930000100_add_timetree_base_payload`, configure one test mapping, and keep both write-enable variables false while checking:

```bash
pnpm timetree:outbound status
pnpm timetree:outbound run --dry-run
```

The dry-run result must report `timeTreeWriteCount: 0` and must not change operation rows. Unit/integration tests use an injected fake adapter to cover CREATE verification, an uncertain save followed by read-only reconciliation, UPDATE, conflict, unshare DELETE, and physical-delete tombstones.

## Canary preparation

Before any canary, review the one pending event, make a database backup, confirm the adapter calendar identity, session validity, write gates, and that no other worker is active. Do not enable a timer for the first canary. The guarded one-event command is:

```bash
TIMETREE_OUTBOUND_WRITES_ENABLED=true pnpm timetree:outbound run --confirm WRITE_TIMETREE --limit 1
```

The adapter process must separately have `TIMETREE_ADAPTER_WRITES_ENABLED=true`. This command is documented for the manual canary and was not executed during implementation.

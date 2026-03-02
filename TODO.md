# Nekt TODO

## E2E Testing
- [ ] Run full E2E regression pass (docs/e2e-test-cases.md)
- [x] Update E2E doc: add Apple CalDAV calendar provider test cases
- [x] Update E2E doc: add calendar provider switching tests (Google <> Apple)
- [x] Update E2E doc: add scheduling notification email flow (Resend)
- [x] Update E2E doc: edge case for email send failure
- [x] Update E2E doc: add SKOverlay / App Clip-to-full-app conversion check
- [x] Update E2E doc: add widget deep link test cases
- [ ] Fix bugs found during E2E pass (track here as discovered)

## Multi-Person / Groups
- [ ] Implement group exchange (spec: spec-group-exchange.md, plan: plan-group-exchange.md)
  - Phase 0: Foundation (types, UI components, QR extraction)
  - Phase 1: Exchange session model (Firestore backend)
  - Phase 2: ExchangeView screen (multi-person)
  - Phase 3: Connections page + Groups (rename History)
  - Phase 4: Group smart scheduling
  - Phase 5: Group AI scheduling
  - Phase 6: Contact syncing (Google + phone)

## Multi-Channel Support
- [ ] iMessage / SMS
- [ ] Telegram
- [ ] Slack
- [ ] Microsoft Teams
- [ ] WhatsApp
- [ ] Discord

## Analytics
- [ ] Integrate PostHog

## Tech Debt
- [ ] Deduplicate web profile code with @nektus/shared-client (6 files flagged with TODOs)
  - save.ts, transforms.ts, avatar.ts, phone-formatter.ts, image.ts, utils.ts

## Offline / Error Resilience (iOS)
- [ ] Handle exchange failures mid-flow gracefully
- [ ] Offline queue for saves/syncs when connectivity drops

## Non-Technical
- [ ] Create Google Voice number
- [ ] Register Nekt as a business
- [ ] Resubmit Microsoft verification
- [ ] Get social handles (nektapp or similar) across all networks
- [ ] Submit to Apple for TestFlight beta testing

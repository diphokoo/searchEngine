# Mining decision workflow update

## Behaviour

- The table's **Approve** button and the details modal's **Approve & Sync to NightLife** button call the same `handleApprove` handler and the same `/admin/mine/approve` API endpoint. They therefore have identical behaviour.
- Approval keeps the existing PostgreSQL event upsert, approval status update, audit logging, and `syncEventToNightlife` integration. The event is then removed from active mining caches and recorded in `mining_event_decisions`.
- **Flag for Review** and **Reject** persist the full mined event payload and decision in `mining_event_decisions`, write an audit entry, and remove the event from active caches.
- General and Facebook mining runs filter persisted decisions to avoid showing previously handled events again.
- **View** and the event details modal remain available.

## Deployment

1. Install dependencies from the repository root with `npm install`.
2. Configure the existing API environment variables and PostgreSQL connection as before.
3. Run `npm run db:migrate --workspace=apps/api`. This creates the decision table and indexes idempotently.
4. Run `npm run build:api` and `npm run build:dashboard`.

The ZIP intentionally excludes `node_modules`, build output, `.git`, and local environment files. Existing NightLife configuration must be supplied in your own environment. A live database and NightLife sync were not available for integration testing here.

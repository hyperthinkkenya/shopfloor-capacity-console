# Shopfloor Capacity Console

A project to undertake capacity planning for work orders using finite planning
and load balancing concepts.

This app is a first working slice for finite scheduling against NetSuite-style
work order data. It models released work orders, routings, work centers,
machines, skilled labour pools, tooling, due dates, and scheduling scenarios a
shopfloor manager would care about.

The current version uses realistic sample data in `app/scheduler-model.ts`.
That file is intentionally shaped like a NetSuite integration boundary:

- `WorkOrder` maps to NetSuite work orders and manufacturing operation tasks.
- `Machine` maps to work centers, machines, and shift calendars.
- `Skill` maps to employee skill groups or custom labour capacity records.
- `Tool` maps to fixtures, nests, gauges, or custom tooling records.
- `PlanBlock` is the finite schedule output that the UI renders as a live plan.

## NetSuite Connection Path

The practical production path is:

1. Pull released work orders, routings, due dates, quantities, and status from
   NetSuite through SuiteTalk REST, RESTlets, or saved-search exports.
2. Pull availability calendars for machines, labour skill groups, and tooling.
3. Normalize those records into the model in `app/scheduler-model.ts`.
4. Replace the sample `plans` with schedule output from the chosen finite
   scheduling engine.
5. Push accepted start and finish dates back to NetSuite work order operations.

The app can later add persistence for saved scenarios and approved schedules.
The starter already includes the deployment wiring for that, but the first
version keeps the model local so the scheduling experience is easy to review.

## Current Planning Features

- Move a selected work order earlier or later in the calendar.
- Change daily calendar hours and automatically recalculate work order load.
- Set a capacity utilization target and replan toward that target.
- Stage NetSuite fetch and schedule-update actions in mock mode.
- Keep the real NetSuite adapter server-side in `app/netsuite-adapter.ts`.

## NetSuite Environment Variables

When connecting to a real NetSuite account, add these variables to the hosting
provider. Do not put these values in browser code or commit them to GitHub.

```text
NETSUITE_ACCOUNT_ID
NETSUITE_CONSUMER_KEY
NETSUITE_CONSUMER_SECRET
NETSUITE_TOKEN_ID
NETSUITE_TOKEN_SECRET
NETSUITE_RESTLET_BASE_URL
```

For the current Netlify Function, use these names:

```text
NETSUITE_ACCOUNT_ID=td3021155
NETSUITE_REST_BASE_URL=https://td3021155.suitetalk.api.netsuite.com/services/rest
NETSUITE_REALM=TD3021155
NETSUITE_CONSUMER_KEY
NETSUITE_CONSUMER_SECRET
NETSUITE_TOKEN_ID
NETSUITE_TOKEN_SECRET
```

For a sandbox account, NetSuite often uses a hyphen in the REST domain and an
underscore in the OAuth realm:

```text
NETSUITE_REST_BASE_URL=https://td3021155-sb1.suitetalk.api.netsuite.com/services/rest
NETSUITE_REALM=TD3021155_SB1
```

After deployment, the work order endpoint is:

```text
/.netlify/functions/netsuite-work-orders
```

The browser app calls this endpoint when you click **Fetch work orders**.

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

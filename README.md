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

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

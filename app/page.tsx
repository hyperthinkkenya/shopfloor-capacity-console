"use client";

import { useMemo, useState } from "react";
import {
  analyzePlan,
  buildNetSuiteUpdatePayload,
  countManualMoves,
  days,
  defaultCalendarHours,
  enforceAllRoutingSequences,
  getChildWorkOrders,
  getMachine,
  getOperation,
  getParentWorkOrder,
  getSkill,
  getTool,
  getWorkOrder,
  getWorkOrderFamilyIds,
  moveOperationAndSuccessors,
  moveWorkOrder,
  moveWorkOrderFamily,
  machines,
  netSuiteSyncDefaults,
  orderProgress,
  plans,
  priorityWeight,
  replanToCapacity,
  recommendations,
  removeWorkOrderFamily,
  scenarioMeta,
  skills,
  tools,
  workOrders,
  type CalendarHours,
  type DailyLoad,
  type DayIndex,
  type NetSuiteSyncState,
  type PlanBlock,
  type RoutingSequenceStatus,
  type ScenarioId,
  type WorkOrder,
} from "./scheduler-model";

type ConstraintView = "machine" | "skill" | "tool";
type CalendarView = "week" | "month" | "quarter";
type VisibleDay = {
  date: string;
  id: string;
  label: string;
  offset: number;
  scheduleDay?: DayIndex;
};

const scenarioOptions = Object.keys(scenarioMeta) as ScenarioId[];
const views: Array<{ id: ConstraintView; label: string }> = [
  { id: "machine", label: "Machines" },
  { id: "skill", label: "Labour" },
  { id: "tool", label: "Tools" },
];
const calendarViews: Array<{ id: CalendarView; label: string; workdays: number }> =
  [
    { id: "week", label: "Week", workdays: 5 },
    { id: "month", label: "Month", workdays: 20 },
    { id: "quarter", label: "Quarter", workdays: 60 },
  ];
const defaultScheduleStartDate = "2026-06-15";

export default function Home() {
  const [scenario, setScenario] = useState<ScenarioId>("balanced");
  const [constraintView, setConstraintView] =
    useState<ConstraintView>("machine");
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [scheduleStartDate, setScheduleStartDate] = useState(
    defaultScheduleStartDate,
  );
  const [selectedOrderId, setSelectedOrderId] = useState(workOrders[0].id);
  const [flexHours, setFlexHours] = useState(1);
  const [calendarHours, setCalendarHours] =
    useState<CalendarHours>(defaultCalendarHours);
  const [utilizationTarget, setUtilizationTarget] = useState(88);
  const [scenarioPlans, setScenarioPlans] =
    useState<Record<ScenarioId, PlanBlock[]>>(plans);
  const [syncState, setSyncState] =
    useState<NetSuiteSyncState>(netSuiteSyncDefaults);

  const plan = scenarioPlans[scenario];
  const analysis = useMemo(
    () => analyzePlan(plan, flexHours, calendarHours),
    [calendarHours, flexHours, plan],
  );
  const selectedOrder = getWorkOrder(selectedOrderId) ?? workOrders[0];
  const orderState = analysis.completedOrders.find(
    (order) => order.id === selectedOrder.id,
  );
  const selectedBlocks = plan.filter(
    (block) => block.workOrderId === selectedOrder.id,
  );
  const selectedSequences = analysis.routingSequences.filter(
    (item) => item.workOrderId === selectedOrder.id,
  );
  const parentOrder = getParentWorkOrder(selectedOrder.id);
  const childOrders = getChildWorkOrders(selectedOrder.id);
  const familyIds = getWorkOrderFamilyIds(selectedOrder.id);
  const visibleOrders = useMemo(() => {
    const rows: WorkOrder[] = [];
    const rootOrders = workOrders
      .filter((order) => !order.parentWorkOrderId)
      .sort((a, b) => {
        const priorityDelta = priorityWeight(b.priority) - priorityWeight(a.priority);
        if (priorityDelta !== 0) return priorityDelta;
        return a.dueDay - b.dueDay;
      });

    function appendOrder(order: WorkOrder) {
      rows.push(order);
      getChildWorkOrders(order.id)
        .sort((a, b) => a.dueDay - b.dueDay)
        .forEach(appendOrder);
    }

    rootOrders.forEach(appendOrder);
    return rows;
  }, []);
  const manualMoveCount = countManualMoves(plan, plans[scenario]);
  const updatePayload = useMemo(() => buildNetSuiteUpdatePayload(plan), [plan]);
  const visibleDays = useMemo(
    () => buildVisibleDays(scheduleStartDate, calendarView),
    [calendarView, scheduleStartDate],
  );
  const planningRangeLabel =
    visibleDays.length > 0
      ? `${visibleDays[0].date} - ${visibleDays[visibleDays.length - 1].date}`
      : "No dates";

  function updatePlan(nextPlan: PlanBlock[]) {
    setScenarioPlans((current) => ({ ...current, [scenario]: nextPlan }));
    setSyncState((current) => ({
      ...current,
      pendingUpdates: countManualMoves(nextPlan, plans[scenario]),
    }));
  }

  function shiftSelectedOrder(deltaDays: number) {
    updatePlan(moveWorkOrder(plan, selectedOrder.id, deltaDays));
  }

  function shiftOperationChain(operationId: string, deltaDays: number) {
    updatePlan(
      moveOperationAndSuccessors(plan, selectedOrder.id, operationId, deltaDays),
    );
  }

  function shiftAssemblyFamily(deltaDays: number) {
    updatePlan(moveWorkOrderFamily(plan, selectedOrder.id, deltaDays));
  }

  function removeAssemblyFamily() {
    updatePlan(removeWorkOrderFamily(plan, selectedOrder.id));
  }

  function autoReplan() {
    const nextPlan = replanToCapacity(
      utilizationTarget / 100,
      calendarHours,
      flexHours,
    );
    updatePlan(nextPlan);
  }

  function resetScenario() {
    updatePlan(plans[scenario]);
  }

  function repairRoutingSequence() {
    updatePlan(enforceAllRoutingSequences(plan));
  }

  function updateCalendarHour(day: DayIndex, hours: number) {
    const nextHours = [...calendarHours] as CalendarHours;
    nextHours[day] = hours;
    setCalendarHours(nextHours);
    const nextPlan = replanToCapacity(utilizationTarget / 100, nextHours, flexHours);
    setScenarioPlans((current) => ({ ...current, [scenario]: nextPlan }));
    setSyncState((current) => ({
      ...current,
      pendingUpdates: countManualMoves(nextPlan, plans[scenario]),
    }));
  }

  function publishToNetSuite() {
    setSyncState({
      lastFetch: syncState.lastFetch,
      lastPublish: `${updatePayload.length} work orders staged for NetSuite`,
      mode: "mock",
      pendingUpdates: 0,
    });
  }

  async function fetchFromNetSuite() {
    setSyncState((current) => ({
      ...current,
      lastFetch: "Contacting NetSuite function...",
    }));

    try {
      const response = await fetch(netSuiteFunctionUrl());
      const data = await response.json();

      if (!response.ok) {
        setSyncState((current) => ({
          ...current,
          lastFetch: data.message ?? "NetSuite function returned an error",
        }));
        return;
      }

      setSyncState((current) => ({
        ...current,
        lastFetch:
          data.mode === "connected" || data.mode === "connected_partial"
            ? netSuiteFetchSummary(data)
            : data.message ?? "NetSuite function is not configured yet",
        mode:
          data.mode === "connected" || data.mode === "connected_partial"
            ? "connected"
            : "mock",
        pendingUpdates: 0,
      }));
    } catch {
      setSyncState((current) => ({
        ...current,
        lastFetch: "Could not reach the NetSuite function",
      }));
    }
  }

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="Schedule command center">
        <div className="brand-block">
          <span className="status-dot" aria-hidden="true" />
          <div>
            <p className="eyebrow">NetSuite finite scheduling</p>
            <h1>Shopfloor capacity console</h1>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="sync-pill">
            <span>Data sync</span>
            <strong>12 min ago</strong>
          </div>
          <div className="scenario-switch" aria-label="Scenario">
            {scenarioOptions.map((option) => (
              <button
                aria-pressed={scenario === option}
                key={option}
                onClick={() => setScenario(option)}
                type="button"
              >
                {scenarioMeta[option].label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="metrics-strip" aria-label="Schedule metrics">
        <Metric
          detail={`${analysis.totalLoad.toFixed(1)} scheduled hours`}
          label="Plant load"
          value={`${analysis.averageUtilization}%`}
        />
        <Metric
          detail={`${analysis.tightOrders.length} tight orders`}
          label="Late risk"
          tone={analysis.lateOrders.length > 0 ? "risk" : "good"}
          value={`${analysis.lateOrders.length}`}
        />
        <Metric
          detail={analysis.peakLoad?.label ?? "No load"}
          label="Peak constraint"
          tone={analysis.peakLoad?.status === "over" ? "risk" : "warn"}
          value={`${analysis.peakLoad?.utilization ?? 0}%`}
        />
        <Metric
          detail={`${manualMoveCount} manual moves staged`}
          label="Target load"
          tone={analysis.averageUtilization > utilizationTarget ? "warn" : "good"}
          value={`${utilizationTarget}%`}
        />
        <Metric
          detail="routing precedence checks"
          label="Sequence breaks"
          tone={analysis.sequenceViolations.length > 0 ? "risk" : "good"}
          value={`${analysis.sequenceViolations.length}`}
        />
        <div className="flex-control">
          <div>
            <span>Flex hours</span>
            <strong>{flexHours}h per critical resource</strong>
          </div>
          <input
            aria-label="Flex hours per critical resource"
            max="3"
            min="0"
            onChange={(event) => setFlexHours(Number(event.target.value))}
            step="1"
            type="range"
            value={flexHours}
          />
        </div>
      </section>

      <section className="planning-strip" aria-label="Scenario planning controls">
        <div className="planner-card">
          <PanelHeader label="Schedule dates" value={planningRangeLabel} />
          <div className="date-filter-controls">
            <label>
              <span>Start date</span>
              <input
                aria-label="Schedule start date"
                onChange={(event) => setScheduleStartDate(event.target.value)}
                type="date"
                value={scheduleStartDate}
              />
            </label>
            <div className="view-mode-switch" aria-label="Calendar horizon">
              {calendarViews.map((view) => (
                <button
                  aria-pressed={calendarView === view.id}
                  key={view.id}
                  onClick={() => setCalendarView(view.id)}
                  type="button"
                >
                  {view.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="planner-card planner-wide">
          <PanelHeader label="Calendar hours" value="auto replan" />
          <div className="day-hour-grid">
            {visibleDays.slice(0, days.length).map((day, dayIndex) => (
              <label key={day.id}>
                <span>{day.label}</span>
                <input
                  aria-label={`${day.label} calendar hours`}
                  max="12"
                  min="0"
                  onChange={(event) =>
                    updateCalendarHour(dayIndex as DayIndex, Number(event.target.value))
                  }
                  step="1"
                  type="number"
                  value={calendarHours[dayIndex]}
                />
              </label>
            ))}
          </div>
        </div>
        <div className="planner-card">
          <PanelHeader label="Capacity target" value={`${utilizationTarget}%`} />
          <input
            aria-label="Capacity utilization target"
            max="100"
            min="60"
            onChange={(event) => setUtilizationTarget(Number(event.target.value))}
            onMouseUp={autoReplan}
            onTouchEnd={autoReplan}
            step="1"
            type="range"
            value={utilizationTarget}
          />
        </div>
        <div className="planner-card planner-actions">
          <button onClick={autoReplan} type="button">
            Auto readjust load
          </button>
          <button onClick={resetScenario} type="button">
            Reset scenario
          </button>
        </div>
      </section>

      <section className="workspace-grid">
        <aside className="queue-panel" aria-label="Work order queue">
          <PanelHeader label="Released work orders" value="7 live" />
          <div className="queue-list">
            {visibleOrders.map((order) => (
              <WorkOrderRow
                blocks={plan}
                isSelected={selectedOrderId === order.id}
                key={order.id}
                onSelect={() => setSelectedOrderId(order.id)}
                order={order}
              />
            ))}
          </div>
        </aside>

        <section className="schedule-panel" aria-label="Finite schedule">
          <div className="schedule-header">
            <div>
              <p className="eyebrow">Scenario</p>
              <h2>{scenarioMeta[scenario].summary}</h2>
              <p>{scenarioMeta[scenario].intent}</p>
            </div>
            <div className="view-tabs" aria-label="Constraint view">
              {views.map((view) => (
                <button
                  aria-pressed={constraintView === view.id}
                  key={view.id}
                  onClick={() => setConstraintView(view.id)}
                  type="button"
                >
                  {view.label}
                </button>
              ))}
            </div>
          </div>

          {constraintView === "machine" ? (
            <MachineSchedule
              blocks={plan}
              calendarHours={calendarHours}
              onSelectOrder={setSelectedOrderId}
              selectedOrderId={selectedOrder.id}
              visibleDays={visibleDays}
            />
          ) : null}
          {constraintView === "skill" ? (
            <LoadMatrix
              loads={analysis.skillLoads}
              resources={skills.map((skill) => ({
                id: skill.id,
                label: skill.label,
              }))}
              title="Skilled labour load"
              visibleDays={visibleDays}
            />
          ) : null}
          {constraintView === "tool" ? (
            <ToolBoard blocks={plan} visibleDays={visibleDays} />
          ) : null}
        </section>

        <aside className="inspector-panel" aria-label="Constraint inspector">
          <PanelHeader
            label="Selected work order"
            value={selectedOrder.netsuiteId}
          />
          <SelectedOrder
            blocks={selectedBlocks}
            childOrders={childOrders}
            familySize={familyIds.length}
            onMoveEarlier={() => shiftSelectedOrder(-1)}
            onMoveFamilyEarlier={() => shiftAssemblyFamily(-1)}
            onMoveFamilyLater={() => shiftAssemblyFamily(1)}
            onMoveLater={() => shiftSelectedOrder(1)}
            onMoveOperationChain={shiftOperationChain}
            onRepairSequence={repairRoutingSequence}
            onRemoveFamily={removeAssemblyFamily}
            order={selectedOrder}
            parentOrder={parentOrder}
            sequenceStatuses={selectedSequences}
            status={orderState?.status ?? "unscheduled"}
          />

          <div className="divider" />

          <PanelHeader label="Bottlenecks" value="live" />
          <ConstraintList
            emptyLabel="Machine capacity is clear."
            loads={analysis.machineLoads}
            title="Machine"
          />
          <ConstraintList
            emptyLabel="Labour capacity is clear."
            loads={analysis.skillLoads}
            title="Labour"
          />
          <ToolConflictList conflicts={analysis.toolConflicts} />
          <SequenceConflictList conflicts={analysis.sequenceViolations} />

          <div className="divider" />

          <PanelHeader
            label="Recommended moves"
            value={scenarioMeta[scenario].label}
          />
          <ol className="recommendations">
            {recommendations[scenario].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>

          <div className="divider" />

          <PanelHeader label="NetSuite connector" value={syncState.mode} />
          <NetSuitePanel
            onFetch={fetchFromNetSuite}
            onPublish={publishToNetSuite}
            pendingUpdates={syncState.pendingUpdates}
            syncState={syncState}
          />
        </aside>
      </section>
    </main>
  );
}

function netSuiteFunctionUrl() {
  if (typeof window !== "undefined" && window.location.protocol === "file:") {
    return "http://localhost:8888/.netlify/functions/netsuite-work-orders";
  }

  return "/.netlify/functions/netsuite-work-orders";
}

function netSuiteFetchSummary(data: {
  count?: number;
  counts?: { operations?: number; resources?: number; tools?: number };
  mode?: string;
  warnings?: string[];
}) {
  const counts = data.counts ?? {};
  const warningSuffix =
    data.mode === "connected_partial" || (data.warnings?.length ?? 0) > 0
      ? " with warnings"
      : "";
  return `Fetched ${data.count ?? 0} work orders, ${
    counts.operations ?? 0
  } operations, ${counts.resources ?? 0} resources, ${
    counts.tools ?? 0
  } tools${warningSuffix}`;
}

function buildVisibleDays(startDate: string, view: CalendarView): VisibleDay[] {
  const viewConfig =
    calendarViews.find((item) => item.id === view) ?? calendarViews[0];
  const start = parseDateInput(startDate);
  const visible: VisibleDay[] = [];
  let cursor = start;

  while (visible.length < viewConfig.workdays) {
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) {
      const offset = visible.length;
      visible.push({
        date: formatMonthDay(cursor),
        id: toDateInputValue(cursor),
        label: formatWeekday(cursor),
        offset,
        scheduleDay:
          offset < days.length ? (offset as DayIndex) : undefined,
      });
    }
    cursor = addDays(cursor, 1);
  }

  return visible;
}

function parseDateInput(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(`${defaultScheduleStartDate}T00:00:00`);
  }
  return parsed;
}

function addDays(date: Date, count: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function formatMonthDay(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat("en", { weekday: "short" }).format(date);
}

function toDateInputValue(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function Metric({
  detail,
  label,
  tone = "neutral",
  value,
}: {
  detail: string;
  label: string;
  tone?: "neutral" | "good" | "warn" | "risk";
  value: string;
}) {
  return (
    <article className={`metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function PanelHeader({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-header">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WorkOrderRow({
  blocks,
  isSelected,
  onSelect,
  order,
}: {
  blocks: PlanBlock[];
  isSelected: boolean;
  onSelect: () => void;
  order: WorkOrder;
}) {
  const progress = orderProgress(order.id, blocks);
  const due = days[order.dueDay];
  const childCount = getChildWorkOrders(order.id).length;

  return (
    <button
      aria-pressed={isSelected}
      className="queue-row"
      onClick={onSelect}
      style={{ paddingLeft: `${12 + order.assemblyLevel * 14}px` }}
      type="button"
    >
      <div className="queue-row-top">
        <strong>{order.id}</strong>
        <span className={`priority priority-${order.priority.toLowerCase()}`}>
          {order.priority}
        </span>
      </div>
      <span>{order.item}</span>
      <div className="queue-meta">
        <span>{order.customer}</span>
        <span>Due {due.label}</span>
      </div>
      <div className="queue-family">
        {order.parentWorkOrderId ? (
          <span>Child of {order.parentWorkOrderId}</span>
        ) : (
          <span>
            {childCount
              ? `${childCount} child orders`
              : "Independent assembly"}
          </span>
        )}
      </div>
      <div className="progress-line" aria-label={`${progress}% routed`}>
        <span style={{ width: `${progress}%` }} />
      </div>
    </button>
  );
}

function MachineSchedule({
  blocks,
  calendarHours,
  onSelectOrder,
  selectedOrderId,
  visibleDays,
}: {
  blocks: PlanBlock[];
  calendarHours: CalendarHours;
  onSelectOrder: (id: string) => void;
  selectedOrderId: string;
  visibleDays: VisibleDay[];
}) {
  return (
    <div className="schedule-scroll">
      <div
        className="schedule-grid"
        style={{
          gridTemplateColumns: `190px repeat(${visibleDays.length}, minmax(130px, 1fr))`,
          minWidth: `${190 + visibleDays.length * 130}px`,
        }}
      >
        <div className="schedule-corner">Resource</div>
        {visibleDays.map((day) => (
          <div className="day-heading" key={day.id}>
            <strong>{day.label}</strong>
            <span>{day.date}</span>
          </div>
        ))}

        {machines.map((machine) => (
          <MachineRow
            blocks={blocks.filter((blockItem) => blockItem.machineId === machine.id)}
            calendarHours={calendarHours}
            key={machine.id}
            machineId={machine.id}
            onSelectOrder={onSelectOrder}
            selectedOrderId={selectedOrderId}
            visibleDays={visibleDays}
          />
        ))}
      </div>
    </div>
  );
}

function MachineRow({
  blocks,
  calendarHours,
  machineId,
  onSelectOrder,
  selectedOrderId,
  visibleDays,
}: {
  blocks: PlanBlock[];
  calendarHours: CalendarHours;
  machineId: string;
  onSelectOrder: (id: string) => void;
  selectedOrderId: string;
  visibleDays: VisibleDay[];
}) {
  const machine = getMachine(machineId);
  if (!machine) return null;

  return (
    <>
      <div className="machine-name">
        <strong>{machine.name}</strong>
        <span>{machine.center}</span>
      </div>
      {visibleDays.map((day) => {
        const scheduleDay = day.scheduleDay;
        const patternDay = (day.offset % days.length) as DayIndex;
        const dayBlocks =
          scheduleDay === undefined
            ? []
            : blocks.filter((blockItem) => blockItem.day === scheduleDay);
        const baseCapacity = machine.availability[patternDay] ?? 0;
        const capacity =
          baseCapacity === 0 ? 0 : Math.min(baseCapacity, calendarHours[patternDay]);
        const dayLoad = dayBlocks.reduce((total, item) => total + item.duration, 0);
        const isOver = capacity > 0 && dayLoad > capacity;

        return (
          <div
            className={`machine-day ${isOver ? "is-over" : ""} ${
              capacity === 0 ? "is-offline" : ""
            }`}
            key={`${machine.id}-${day.id}`}
          >
            <span className="shift-capacity">{capacity ? `${capacity}h` : "down"}</span>
            {dayBlocks.map((blockItem) => {
              const order = getWorkOrder(blockItem.workOrderId);
              const operation = getOperation(blockItem);
              const left = Math.min(100, (blockItem.start / 8) * 100);
              const width = Math.min(100 - left, (blockItem.duration / 8) * 100);

              return (
                <button
                  aria-label={`${blockItem.workOrderId} ${operation?.label ?? ""}`}
                  className={`schedule-block ${
                    selectedOrderId === blockItem.workOrderId ? "is-selected" : ""
                  }`}
                  key={blockItem.id}
                  onClick={() => onSelectOrder(blockItem.workOrderId)}
                  style={{
                    background: machine.color,
                    left: `${left}%`,
                    width: `${Math.max(width, 16)}%`,
                  }}
                  title={blockItem.note}
                  type="button"
                >
                  <strong>{order?.id}</strong>
                  <span>{operation?.step}</span>
                </button>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function LoadMatrix({
  loads,
  resources,
  title,
  visibleDays,
}: {
  loads: DailyLoad[];
  resources: Array<{ id: string; label: string }>;
  title: string;
  visibleDays: VisibleDay[];
}) {
  return (
    <div
      className="load-matrix"
      aria-label={title}
      style={{
        gridTemplateColumns: `190px repeat(${visibleDays.length}, minmax(125px, 1fr))`,
        minWidth: `${190 + visibleDays.length * 125}px`,
      }}
    >
      <div className="load-resource-heading">Resource</div>
      {visibleDays.map((day) => (
        <div className="load-day-heading" key={day.id}>
          {day.label}
        </div>
      ))}
      {resources.map((resource) => (
        <ResourceLoadRow
          key={resource.id}
          loads={loads}
          resource={resource}
          visibleDays={visibleDays}
        />
      ))}
    </div>
  );
}

function ResourceLoadRow({
  loads,
  resource,
  visibleDays,
}: {
  loads: DailyLoad[];
  resource: { id: string; label: string };
  visibleDays: VisibleDay[];
}) {
  return (
    <>
      <div className="load-resource-name">{resource.label}</div>
      {visibleDays.map((day) => {
        const load = loads.find(
          (item) => item.id === resource.id && item.day === day.scheduleDay,
        );
        const value = load?.utilization ?? 0;
        return (
          <div
            className={`load-cell load-${load?.status ?? "open"}`}
            key={`${resource.id}-${day.id}`}
          >
            <strong>{value}%</strong>
            <span>
              {(load?.load ?? 0).toFixed(1)} / {(load?.capacity ?? 0).toFixed(1)}h
            </span>
            <i style={{ width: `${Math.min(value, 100)}%` }} />
          </div>
        );
      })}
    </>
  );
}

function ToolBoard({
  blocks,
  visibleDays,
}: {
  blocks: PlanBlock[];
  visibleDays: VisibleDay[];
}) {
  return (
    <div className="tool-board">
      {tools.map((tool) => {
        const useCount = blocks.filter((blockItem) => {
          const operation = getOperation(blockItem);
          return operation?.toolId === tool.id;
        }).length;

        return (
          <article className="tool-row" key={tool.id}>
            <div>
              <strong>{tool.label}</strong>
              <span>{tool.location}</span>
            </div>
            <div className="tool-days">
              {visibleDays.map((day) => {
                const dayBlocks =
                  day.scheduleDay === undefined
                    ? []
                    : blocks.filter((blockItem) => {
                        const operation = getOperation(blockItem);
                        return (
                          operation?.toolId === tool.id &&
                          blockItem.day === day.scheduleDay
                        );
                      });
                return (
                  <span
                    className={dayBlocks.length > tool.quantity ? "tool-busy" : ""}
                    key={`${tool.id}-${day.id}`}
                  >
                    {dayBlocks.length}
                  </span>
                );
              })}
            </div>
            <small>
              {useCount} bookings, {tool.quantity} available
            </small>
          </article>
        );
      })}
    </div>
  );
}

function SelectedOrder({
  blocks,
  childOrders,
  familySize,
  onMoveEarlier,
  onMoveFamilyEarlier,
  onMoveFamilyLater,
  onMoveLater,
  onMoveOperationChain,
  onRepairSequence,
  onRemoveFamily,
  order,
  parentOrder,
  sequenceStatuses,
  status,
}: {
  blocks: PlanBlock[];
  childOrders: WorkOrder[];
  familySize: number;
  onMoveEarlier: () => void;
  onMoveFamilyEarlier: () => void;
  onMoveFamilyLater: () => void;
  onMoveLater: () => void;
  onMoveOperationChain: (operationId: string, deltaDays: number) => void;
  onRepairSequence: () => void;
  onRemoveFamily: () => void;
  order: WorkOrder;
  parentOrder?: WorkOrder;
  sequenceStatuses: RoutingSequenceStatus[];
  status: string;
}) {
  return (
    <div className="selected-order">
      <div className="selected-title">
        <div>
          <h3>{order.id}</h3>
          <p>{order.item}</p>
        </div>
        <span className={`status-label status-${status}`}>{status}</span>
      </div>
      <div className="selected-facts">
        <span>{order.customer}</span>
        <span>{order.quantity} units</span>
        <span>Due {days[order.dueDay].label}</span>
        <span>{order.materialStatus}</span>
        <span>Level {order.assemblyLevel}</span>
        {parentOrder ? <span>Child of {parentOrder.id}</span> : null}
        {childOrders.length > 0 ? (
          <span>{childOrders.length} direct children</span>
        ) : null}
      </div>
      <div className="reschedule-actions">
        <button onClick={onMoveEarlier} type="button">
          Move earlier
        </button>
        <button onClick={onMoveLater} type="button">
          Move later
        </button>
        <button onClick={onRepairSequence} type="button">
          Repair sequence
        </button>
      </div>
      <div className="family-actions">
        <button onClick={onMoveFamilyEarlier} type="button">
          Move family earlier
        </button>
        <button onClick={onMoveFamilyLater} type="button">
          Move family later
        </button>
        <button onClick={onRemoveFamily} type="button">
          Remove family ({familySize})
        </button>
      </div>
      <div className="routing-list">
        {order.routing.map((operation) => {
          const scheduled = blocks.find(
            (item) => item.operationId === operation.id,
          );
          const machine = getMachine(operation.machineId);
          const skill = getSkill(operation.skill);
          const tool = getTool(operation.toolId);
          const sequence = sequenceStatuses.find(
            (item) => item.operationId === operation.id,
          );
          return (
            <div
              className={`routing-step routing-${sequence?.status ?? "unscheduled"}`}
              key={operation.id}
            >
              <strong>Op {operation.step}</strong>
              <span>
                {operation.label}
                <i>{sequence?.status ?? "unscheduled"}</i>
              </span>
              <small>
                {machine?.name} | {skill?.label} | {tool?.label}
              </small>
              <em>
                {scheduled
                  ? `${days[scheduled.day].label} ${scheduled.start.toFixed(1)}h`
                  : "Not scheduled"}
              </em>
              <small>{sequence?.message}</small>
              <div className="operation-actions">
                <button
                  onClick={() => onMoveOperationChain(operation.id, -1)}
                  type="button"
                >
                  Chain earlier
                </button>
                <button
                  onClick={() => onMoveOperationChain(operation.id, 1)}
                  type="button"
                >
                  Chain later
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SequenceConflictList({
  conflicts,
}: {
  conflicts: RoutingSequenceStatus[];
}) {
  return (
    <div className="constraint-group">
      <span>Routing sequence</span>
      {conflicts.length === 0 ? (
        <p>All routed operations follow their predecessor sequence.</p>
      ) : (
        conflicts.slice(0, 3).map((conflict) => (
          <div
            className="constraint-row"
            key={`${conflict.workOrderId}-${conflict.operationId}`}
          >
            <strong>{conflict.workOrderId}</strong>
            <span>{conflict.message}</span>
          </div>
        ))
      )}
    </div>
  );
}

function NetSuitePanel({
  onFetch,
  onPublish,
  pendingUpdates,
  syncState,
}: {
  onFetch: () => void;
  onPublish: () => void;
  pendingUpdates: number;
  syncState: NetSuiteSyncState;
}) {
  return (
    <div className="netsuite-panel">
      <p>
        Live credentials stay in the Netlify Function. Fetch pulls NetSuite
        work orders and routings; schedule updates are still staged safely.
      </p>
      <div className="sync-facts">
        <span>Fetch: {syncState.lastFetch}</span>
        <span>Publish: {syncState.lastPublish}</span>
        <span>{pendingUpdates} schedule changes waiting</span>
      </div>
      <div className="connector-actions">
        <button onClick={onFetch} type="button">
          Fetch work orders
        </button>
        <button onClick={onPublish} type="button">
          Stage NetSuite update
        </button>
      </div>
    </div>
  );
}

function ConstraintList({
  emptyLabel,
  loads,
  title,
}: {
  emptyLabel: string;
  loads: DailyLoad[];
  title: string;
}) {
  const constrained = loads
    .filter((load) => load.status === "over")
    .sort((a, b) => b.utilization - a.utilization)
    .slice(0, 3);

  return (
    <div className="constraint-group">
      <span>{title}</span>
      {constrained.length === 0 ? (
        <p>{emptyLabel}</p>
      ) : (
        constrained.map((load) => (
          <div className="constraint-row" key={`${load.id}-${load.day}`}>
            <strong>{load.label}</strong>
            <span>
              {days[load.day].label} at {load.utilization}%
            </span>
          </div>
        ))
      )}
    </div>
  );
}

function ToolConflictList({
  conflicts,
}: {
  conflicts: Array<{ tool: string; day: DayIndex; orders: string[] }>;
}) {
  return (
    <div className="constraint-group">
      <span>Tools</span>
      {conflicts.length === 0 ? (
        <p>Tooling has no overlapping bookings.</p>
      ) : (
        conflicts.slice(0, 3).map((conflict) => (
          <div
            className="constraint-row"
            key={`${conflict.tool}-${conflict.day}`}
          >
            <strong>{conflict.tool}</strong>
            <span>
              {days[conflict.day].label}: {conflict.orders.join(", ")}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

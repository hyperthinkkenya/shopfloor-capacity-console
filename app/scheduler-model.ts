export type DayIndex = 0 | 1 | 2 | 3 | 4;
export type ScenarioId = "baseline" | "balanced" | "rush";
export type Priority = "Hot" | "High" | "Standard";

export type Operation = {
  id: string;
  step: string;
  label: string;
  machineId: string;
  skill: string;
  toolId: string;
  duration: number;
  skillHours: number;
};

export type WorkOrder = {
  id: string;
  netsuiteId: string;
  customer: string;
  item: string;
  quantity: number;
  dueDay: DayIndex;
  priority: Priority;
  materialStatus: "Released" | "Partial" | "Hold";
  routing: Operation[];
};

export type Machine = {
  id: string;
  name: string;
  center: string;
  availability: number[];
  color: string;
};

export type Skill = {
  id: string;
  label: string;
  availability: number[];
};

export type Tool = {
  id: string;
  label: string;
  quantity: number;
  location: string;
};

export type PlanBlock = {
  id: string;
  workOrderId: string;
  operationId: string;
  machineId: string;
  day: DayIndex;
  start: number;
  duration: number;
  note?: string;
};

export type DailyLoad = {
  id: string;
  label: string;
  day: DayIndex;
  load: number;
  capacity: number;
  utilization: number;
  status: "open" | "full" | "over";
};

export type CalendarHours = [number, number, number, number, number];

export type NetSuiteSyncState = {
  lastFetch: string;
  lastPublish: string;
  mode: "mock" | "connected";
  pendingUpdates: number;
};

export const days = [
  { id: "mon", label: "Mon", date: "Jun 15" },
  { id: "tue", label: "Tue", date: "Jun 16" },
  { id: "wed", label: "Wed", date: "Jun 17" },
  { id: "thu", label: "Thu", date: "Jun 18" },
  { id: "fri", label: "Fri", date: "Jun 19" },
] as const;

export const defaultCalendarHours: CalendarHours = [8, 8, 8, 8, 8];

export const netSuiteSyncDefaults: NetSuiteSyncState = {
  lastFetch: "Mock data loaded",
  lastPublish: "Not published",
  mode: "mock",
  pendingUpdates: 0,
};

export const scenarioMeta: Record<
  ScenarioId,
  { label: string; summary: string; intent: string }
> = {
  baseline: {
    label: "Baseline",
    summary: "Current promise dates with first-fit loading from NetSuite.",
    intent: "Shows the overload before any balancing moves are applied.",
  },
  balanced: {
    label: "Balanced",
    summary: "Moves CNC spillover and protects constrained QA hours.",
    intent: "Best view for the shopfloor manager morning standup.",
  },
  rush: {
    label: "Rush order",
    summary: "Expedites hot orders and flags the labour tradeoffs.",
    intent: "Useful when sales or service asks what can be pulled forward.",
  },
};

export const machines: Machine[] = [
  {
    id: "M-CNC-01",
    name: "Mazak VCN 530C",
    center: "CNC milling",
    availability: [8, 8, 6, 8, 0],
    color: "#0f766e",
  },
  {
    id: "M-CNC-02",
    name: "Doosan DNM 5700",
    center: "CNC milling",
    availability: [8, 6, 8, 8, 6],
    color: "#2563eb",
  },
  {
    id: "M-LASER-01",
    name: "Bystronic laser",
    center: "Laser cutting",
    availability: [8, 8, 8, 4, 8],
    color: "#7c3aed",
  },
  {
    id: "M-WELD-01",
    name: "Weld cell A",
    center: "Fabrication",
    availability: [6, 8, 8, 8, 8],
    color: "#c2410c",
  },
  {
    id: "M-ASSY-01",
    name: "Assembly bay 2",
    center: "Assembly",
    availability: [8, 8, 8, 8, 8],
    color: "#047857",
  },
  {
    id: "M-QA-01",
    name: "CMM and final QA",
    center: "Inspection",
    availability: [5, 5, 5, 5, 5],
    color: "#be123c",
  },
];

export const skills: Skill[] = [
  { id: "cnc", label: "CNC setup", availability: [10, 10, 8, 10, 5] },
  { id: "laser", label: "Laser operator", availability: [6, 6, 6, 4, 6] },
  { id: "weld", label: "Certified welder", availability: [6, 8, 8, 8, 6] },
  { id: "assembly", label: "Assembly tech", availability: [6, 6, 6, 6, 6] },
  { id: "qa", label: "QA inspector", availability: [4, 4, 4, 4, 4] },
];

export const tools: Tool[] = [
  { id: "T-MILL-42", label: "Fixture A-12", quantity: 1, location: "CNC crib" },
  { id: "T-DRILL-06", label: "Drill nest 06", quantity: 1, location: "Tool room" },
  { id: "T-LAS-09", label: "Laser nest 09", quantity: 2, location: "Laser rack" },
  { id: "T-WELD-18", label: "Weld fixture 18", quantity: 1, location: "Weld cell A" },
  { id: "T-CMM-03", label: "CMM probe kit", quantity: 1, location: "QA lab" },
  { id: "T-ASSY-11", label: "Assembly jig 11", quantity: 1, location: "Assembly bay" },
];

export const workOrders: WorkOrder[] = [
  {
    id: "WO-1048",
    netsuiteId: "NS-WO-89731",
    customer: "AeroMotion",
    item: "Pump body P-42",
    quantity: 48,
    dueDay: 2,
    priority: "Hot",
    materialStatus: "Released",
    routing: [
      op("op10", "10", "Rough mill", "M-CNC-01", "cnc", "T-MILL-42", 5.5, 2.5),
      op("op20", "20", "Finish mill", "M-CNC-02", "cnc", "T-MILL-42", 3.5, 1.5),
      op("op30", "30", "CMM inspect", "M-QA-01", "qa", "T-CMM-03", 1.5, 1.5),
    ],
  },
  {
    id: "WO-1051",
    netsuiteId: "NS-WO-89746",
    customer: "HydraValve",
    item: "Manifold HV-8",
    quantity: 32,
    dueDay: 3,
    priority: "High",
    materialStatus: "Released",
    routing: [
      op("op10", "10", "Laser blanks", "M-LASER-01", "laser", "T-LAS-09", 4, 2),
      op("op20", "20", "Drill ports", "M-CNC-02", "cnc", "T-DRILL-06", 4, 2),
      op("op30", "30", "Tack weld", "M-WELD-01", "weld", "T-WELD-18", 3, 3),
    ],
  },
  {
    id: "WO-1058",
    netsuiteId: "NS-WO-89752",
    customer: "CleanPack",
    item: "Guard rail kit",
    quantity: 120,
    dueDay: 4,
    priority: "Standard",
    materialStatus: "Partial",
    routing: [
      op("op10", "10", "Laser rails", "M-LASER-01", "laser", "T-LAS-09", 5, 2.5),
      op("op20", "20", "Weld brackets", "M-WELD-01", "weld", "T-WELD-18", 4, 4),
      op("op30", "30", "Pack assembly", "M-ASSY-01", "assembly", "T-ASSY-11", 3, 3),
    ],
  },
  {
    id: "WO-1062",
    netsuiteId: "NS-WO-89757",
    customer: "MetroRail",
    item: "Bracket kit",
    quantity: 64,
    dueDay: 1,
    priority: "Hot",
    materialStatus: "Released",
    routing: [
      op("op10", "10", "Mill bracket", "M-CNC-01", "cnc", "T-MILL-42", 4, 1.8),
      op("op20", "20", "Weld tabs", "M-WELD-01", "weld", "T-WELD-18", 2, 2),
      op("op30", "30", "Final QA", "M-QA-01", "qa", "T-CMM-03", 1, 1),
    ],
  },
  {
    id: "WO-1067",
    netsuiteId: "NS-WO-89760",
    customer: "AgriPro",
    item: "Auger hub",
    quantity: 80,
    dueDay: 4,
    priority: "High",
    materialStatus: "Released",
    routing: [
      op("op10", "10", "Mill hub", "M-CNC-02", "cnc", "T-DRILL-06", 6, 2.8),
      op("op20", "20", "Assembly", "M-ASSY-01", "assembly", "T-ASSY-11", 4, 4),
      op("op30", "30", "QA release", "M-QA-01", "qa", "T-CMM-03", 1, 1),
    ],
  },
  {
    id: "WO-1070",
    netsuiteId: "NS-WO-89769",
    customer: "Service",
    item: "Rush repair kit",
    quantity: 12,
    dueDay: 3,
    priority: "Hot",
    materialStatus: "Released",
    routing: [
      op("op10", "10", "CNC rework", "M-CNC-01", "cnc", "T-MILL-42", 3, 1.2),
      op("op20", "20", "QA release", "M-QA-01", "qa", "T-CMM-03", 1.5, 1.5),
    ],
  },
  {
    id: "WO-1074",
    netsuiteId: "NS-WO-89771",
    customer: "MedLine",
    item: "Stainless frame",
    quantity: 28,
    dueDay: 4,
    priority: "High",
    materialStatus: "Released",
    routing: [
      op("op10", "10", "Laser frame", "M-LASER-01", "laser", "T-LAS-09", 3, 1.5),
      op("op20", "20", "TIG weld", "M-WELD-01", "weld", "T-WELD-18", 5, 5),
      op("op30", "30", "Final QA", "M-QA-01", "qa", "T-CMM-03", 2, 2),
    ],
  },
];

export const plans: Record<ScenarioId, PlanBlock[]> = {
  baseline: [
    block("b-1", "WO-1062", "op10", "M-CNC-01", 0, 0, 4),
    block("b-2", "WO-1048", "op10", "M-CNC-01", 0, 4, 5.5, "Runs past shift"),
    block("b-3", "WO-1067", "op10", "M-CNC-02", 0, 0, 6),
    block("b-4", "WO-1051", "op20", "M-CNC-02", 0, 6, 4, "CNC spillover"),
    block("b-5", "WO-1051", "op10", "M-LASER-01", 0, 0, 4),
    block("b-6", "WO-1058", "op10", "M-LASER-01", 0, 4, 5, "Laser overrun"),
    block("b-7", "WO-1062", "op20", "M-WELD-01", 0, 3.5, 2),
    block("b-8", "WO-1070", "op10", "M-CNC-01", 1, 0, 3),
    block("b-9", "WO-1048", "op20", "M-CNC-02", 1, 2, 3.5),
    block("b-10", "WO-1051", "op30", "M-WELD-01", 1, 1, 3),
    block("b-11", "WO-1058", "op20", "M-WELD-01", 1, 4, 4),
    block("b-12", "WO-1062", "op30", "M-QA-01", 1, 0, 1),
    block("b-13", "WO-1048", "op30", "M-QA-01", 1, 4.25, 1.5),
    block("b-14", "WO-1058", "op30", "M-ASSY-01", 2, 0, 3),
    block("b-15", "WO-1067", "op20", "M-ASSY-01", 2, 3.25, 4),
    block("b-16", "WO-1070", "op20", "M-QA-01", 2, 3.5, 1.5),
    block("b-17", "WO-1074", "op10", "M-LASER-01", 3, 0, 3),
    block("b-18", "WO-1074", "op20", "M-WELD-01", 3, 2, 5),
    block("b-19", "WO-1067", "op30", "M-QA-01", 4, 1, 1),
    block("b-20", "WO-1074", "op30", "M-QA-01", 4, 2.5, 2),
  ],
  balanced: [
    block("p-1", "WO-1062", "op10", "M-CNC-01", 0, 0, 4),
    block("p-2", "WO-1051", "op10", "M-LASER-01", 0, 0, 4),
    block("p-3", "WO-1067", "op10", "M-CNC-02", 0, 0, 6),
    block("p-4", "WO-1062", "op20", "M-WELD-01", 0, 4, 2),
    block("p-5", "WO-1048", "op10", "M-CNC-01", 1, 0, 5.5),
    block("p-6", "WO-1051", "op20", "M-CNC-02", 1, 0.5, 4),
    block("p-7", "WO-1058", "op10", "M-LASER-01", 1, 1, 5),
    block("p-8", "WO-1062", "op30", "M-QA-01", 1, 0, 1),
    block("p-9", "WO-1070", "op10", "M-CNC-01", 1, 5.5, 3, "Uses flex hour"),
    block("p-10", "WO-1048", "op20", "M-CNC-02", 2, 0, 3.5),
    block("p-11", "WO-1051", "op30", "M-WELD-01", 2, 0, 3),
    block("p-12", "WO-1048", "op30", "M-QA-01", 2, 1.25, 1.5),
    block("p-13", "WO-1058", "op20", "M-WELD-01", 2, 3.5, 4),
    block("p-14", "WO-1070", "op20", "M-QA-01", 3, 0, 1.5),
    block("p-15", "WO-1058", "op30", "M-ASSY-01", 3, 0, 3),
    block("p-16", "WO-1067", "op20", "M-ASSY-01", 3, 3.25, 4),
    block("p-17", "WO-1074", "op10", "M-LASER-01", 4, 0, 3),
    block("p-18", "WO-1074", "op20", "M-WELD-01", 4, 0, 5),
    block("p-19", "WO-1067", "op30", "M-QA-01", 4, 0, 1),
    block("p-20", "WO-1074", "op30", "M-QA-01", 4, 2.25, 2),
  ],
  rush: [
    block("r-1", "WO-1062", "op10", "M-CNC-01", 0, 0, 4),
    block("r-2", "WO-1070", "op10", "M-CNC-01", 0, 4.25, 3),
    block("r-3", "WO-1051", "op10", "M-LASER-01", 0, 0, 4),
    block("r-4", "WO-1067", "op10", "M-CNC-02", 0, 0, 6),
    block("r-5", "WO-1062", "op20", "M-WELD-01", 0, 4, 2),
    block("r-6", "WO-1070", "op20", "M-QA-01", 1, 0, 1.5),
    block("r-7", "WO-1048", "op10", "M-CNC-01", 1, 0, 5.5),
    block("r-8", "WO-1051", "op20", "M-CNC-02", 1, 0.5, 4),
    block("r-9", "WO-1062", "op30", "M-QA-01", 1, 2, 1),
    block("r-10", "WO-1048", "op20", "M-CNC-02", 2, 0, 3.5),
    block("r-11", "WO-1048", "op30", "M-QA-01", 2, 0, 1.5),
    block("r-12", "WO-1051", "op30", "M-WELD-01", 2, 0, 3),
    block("r-13", "WO-1074", "op10", "M-LASER-01", 2, 4, 3),
    block("r-14", "WO-1074", "op20", "M-WELD-01", 2, 3.25, 5, "Welder overload"),
    block("r-15", "WO-1058", "op10", "M-LASER-01", 3, 0, 5),
    block("r-16", "WO-1058", "op20", "M-WELD-01", 3, 0, 4),
    block("r-17", "WO-1067", "op20", "M-ASSY-01", 3, 0, 4),
    block("r-18", "WO-1058", "op30", "M-ASSY-01", 4, 0, 3),
    block("r-19", "WO-1067", "op30", "M-QA-01", 4, 0, 1),
    block("r-20", "WO-1074", "op30", "M-QA-01", 4, 1.25, 2),
  ],
};

export const recommendations: Record<ScenarioId, string[]> = {
  baseline: [
    "Move WO-1048 op 10 from Monday to Tuesday CNC-01 to remove the first overload.",
    "Split QA release work across Wednesday and Thursday before accepting new rush jobs.",
    "Reserve Fixture A-12 for MetroRail first; AeroMotion can follow once the hot order clears.",
  ],
  balanced: [
    "Approve one CNC flex hour Tuesday to keep WO-1070 inside the promised window.",
    "Keep Friday QA protected for MedLine and AgriPro final release checks.",
    "Do not pull CleanPack earlier unless another certified welder is added on Wednesday.",
  ],
  rush: [
    "Rush service work is feasible, but Wednesday welding becomes the constraint.",
    "Ask sales whether MedLine can ship Friday afternoon; otherwise add a welder on Wednesday.",
    "Hold the CleanPack guard rail kit at partial material status until laser time is confirmed.",
  ],
};

export function getWorkOrder(id: string) {
  return workOrders.find((order) => order.id === id);
}

export function getMachine(id: string) {
  return machines.find((machine) => machine.id === id);
}

export function getSkill(id: string) {
  return skills.find((skill) => skill.id === id);
}

export function getTool(id: string) {
  return tools.find((tool) => tool.id === id);
}

export function getOperation(blockItem: PlanBlock) {
  const order = getWorkOrder(blockItem.workOrderId);
  return order?.routing.find((operation) => operation.id === blockItem.operationId);
}

export function analyzePlan(
  blocks: PlanBlock[],
  flexHours: number,
  calendarHours: CalendarHours = defaultCalendarHours,
) {
  const machineLoads = machines.flatMap((machine) =>
    days.map((_, dayIndex) => {
      const day = dayIndex as DayIndex;
      const load = sum(
        blocks
          .filter((item) => item.machineId === machine.id && item.day === day)
          .map((item) => item.duration),
      );
      const capacity = effectiveMachineCapacity(machine, day, calendarHours, flexHours);
      return toDailyLoad(machine.id, machine.name, day, load, capacity);
    }),
  );

  const skillLoads = skills.flatMap((skill) =>
    days.map((_, dayIndex) => {
      const day = dayIndex as DayIndex;
      const load = sum(
        blocks
          .filter((item) => item.day === day)
          .map((item) => {
            const operation = getOperation(item);
            return operation?.skill === skill.id ? operation.skillHours : 0;
          }),
      );
      const capacity = effectiveSkillCapacity(skill, day, calendarHours, flexHours);
      return toDailyLoad(skill.id, skill.label, day, load, capacity);
    }),
  );

  const completedOrders = workOrders.map((order) => {
    const orderBlocks = blocks.filter((item) => item.workOrderId === order.id);
    const finish = Math.max(
      ...orderBlocks.map((item) => item.day + (item.start + item.duration) / 8),
      -1,
    );
    const due = order.dueDay + 1;
    const status =
      finish < 0
        ? "unscheduled"
        : finish > due
          ? "late"
          : finish > due - 0.2
            ? "tight"
            : "on-track";

    return {
      id: order.id,
      finish,
      status,
      dueDay: order.dueDay,
    };
  });

  const totalLoad = sum(machineLoads.map((item) => item.load));
  const totalCapacity = sum(machineLoads.map((item) => item.capacity));
  const averageUtilization =
    totalCapacity > 0 ? Math.round((totalLoad / totalCapacity) * 100) : 0;
  const lateOrders = completedOrders.filter((order) => order.status === "late");
  const tightOrders = completedOrders.filter((order) => order.status === "tight");
  const peakLoad = [...machineLoads, ...skillLoads].sort(
    (a, b) => b.utilization - a.utilization,
  )[0];

  return {
    averageUtilization,
    completedOrders,
    lateOrders,
    machineLoads,
    peakLoad,
    skillLoads,
    tightOrders,
    toolConflicts: findToolConflicts(blocks),
    totalLoad,
  };
}

export function replanToCapacity(
  targetUtilization: number,
  calendarHours: CalendarHours,
  flexHours = 0,
): PlanBlock[] {
  const machineBooked = new Map<string, number[]>();
  const skillBooked = new Map<string, number[]>();
  const orderFinish = new Map<string, number>();
  const plan: PlanBlock[] = [];
  const targetRatio = Math.max(0.55, Math.min(targetUtilization, 1.1));

  machines.forEach((machine) => machineBooked.set(machine.id, [0, 0, 0, 0, 0]));
  skills.forEach((skill) => skillBooked.set(skill.id, [0, 0, 0, 0, 0]));

  const sortedOrders = [...workOrders].sort((a, b) => {
    const dueDelta = a.dueDay - b.dueDay;
    if (dueDelta !== 0) return dueDelta;
    return priorityWeight(b.priority) - priorityWeight(a.priority);
  });

  sortedOrders.forEach((order) => {
    order.routing.forEach((operation) => {
      const earliest = Math.max(0, orderFinish.get(order.id) ?? 0);
      const placement = findPlacement(
        operation,
        earliest,
        machineBooked,
        skillBooked,
        calendarHours,
        flexHours,
        targetRatio,
      );
      const id = `auto-${order.id}-${operation.id}`;
      plan.push(
        block(
          id,
          order.id,
          operation.id,
          operation.machineId,
          placement.day,
          placement.start,
          operation.duration,
          placement.note,
        ),
      );
      machineBooked.get(operation.machineId)![placement.day] += operation.duration;
      skillBooked.get(operation.skill)![placement.day] += operation.skillHours;
      orderFinish.set(order.id, placement.day + (placement.start + operation.duration) / 8);
    });
  });

  return plan;
}

export function moveWorkOrder(
  blocks: PlanBlock[],
  workOrderId: string,
  deltaDays: number,
): PlanBlock[] {
  return blocks.map((item) => {
    if (item.workOrderId !== workOrderId) return item;
    const nextDay = Math.max(0, Math.min(days.length - 1, item.day + deltaDays)) as DayIndex;
    return {
      ...item,
      day: nextDay,
      note:
        deltaDays === 0
          ? item.note
          : `${item.note ? `${item.note}; ` : ""}Manual move ${deltaDays > 0 ? "later" : "earlier"}`,
    };
  });
}

export function countManualMoves(plan: PlanBlock[], originalPlan: PlanBlock[]) {
  return plan.filter((item) => {
    const original = originalPlan.find(
      (candidate) =>
        candidate.workOrderId === item.workOrderId &&
        candidate.operationId === item.operationId,
    );
    return original && original.day !== item.day;
  }).length;
}

export function buildNetSuiteUpdatePayload(blocks: PlanBlock[]) {
  return workOrders.map((order) => ({
    netsuiteId: order.netsuiteId,
    operations: order.routing.map((operation) => {
      const scheduled = blocks.find(
        (item) => item.workOrderId === order.id && item.operationId === operation.id,
      );
      return {
        operation: operation.step,
        workCenter: operation.machineId,
        scheduledDay: scheduled ? days[scheduled.day].label : null,
        startHour: scheduled?.start ?? null,
        durationHours: scheduled?.duration ?? operation.duration,
      };
    }),
  }));
}

export function orderProgress(orderId: string, blocks: PlanBlock[]) {
  const order = getWorkOrder(orderId);
  if (!order) return 0;
  const complete = order.routing.filter((operation) =>
    blocks.some(
      (item) => item.workOrderId === orderId && item.operationId === operation.id,
    ),
  ).length;
  return Math.round((complete / order.routing.length) * 100);
}

export function priorityWeight(priority: Priority) {
  if (priority === "Hot") return 3;
  if (priority === "High") return 2;
  return 1;
}

function op(
  id: string,
  step: string,
  label: string,
  machineId: string,
  skill: string,
  toolId: string,
  duration: number,
  skillHours: number,
): Operation {
  return { id, step, label, machineId, skill, toolId, duration, skillHours };
}

function block(
  id: string,
  workOrderId: string,
  operationId: string,
  machineId: string,
  day: DayIndex,
  start: number,
  duration: number,
  note?: string,
): PlanBlock {
  return { id, workOrderId, operationId, machineId, day, start, duration, note };
}

function toDailyLoad(
  id: string,
  label: string,
  day: DayIndex,
  load: number,
  capacity: number,
): DailyLoad {
  const utilization = capacity > 0 ? Math.round((load / capacity) * 100) : load > 0 ? 999 : 0;
  const status = utilization > 100 ? "over" : utilization >= 88 ? "full" : "open";
  return { id, label, day, load, capacity, utilization, status };
}

function effectiveMachineCapacity(
  machine: Machine,
  day: DayIndex,
  calendarHours: CalendarHours,
  flexHours: number,
) {
  if (machine.availability[day] === 0 || calendarHours[day] === 0) return 0;
  return Math.min(machine.availability[day], calendarHours[day]) + flexHours;
}

function effectiveSkillCapacity(
  skill: Skill,
  day: DayIndex,
  calendarHours: CalendarHours,
  flexHours: number,
) {
  if (calendarHours[day] === 0) return 0;
  const baseCapacity = skill.availability[day] * (calendarHours[day] / 8);
  return baseCapacity + Math.min(2, flexHours);
}

function findPlacement(
  operation: Operation,
  earliestFinish: number,
  machineBooked: Map<string, number[]>,
  skillBooked: Map<string, number[]>,
  calendarHours: CalendarHours,
  flexHours: number,
  targetRatio: number,
) {
  const machine = getMachine(operation.machineId);
  const skill = getSkill(operation.skill);
  if (!machine || !skill) {
    return { day: 0 as DayIndex, start: 0, note: "Missing resource master" };
  }

  const earliestDay = Math.max(0, Math.min(days.length - 1, Math.floor(earliestFinish))) as DayIndex;
  const fallbackDay = Math.max(0, Math.min(days.length - 1, earliestDay)) as DayIndex;
  let fallback = {
    day: fallbackDay,
    start: machineBooked.get(operation.machineId)![fallbackDay],
    note: "Placed above target to keep routing complete",
  };

  for (let dayIndex = earliestDay; dayIndex < days.length; dayIndex += 1) {
    const day = dayIndex as DayIndex;
    const machineCapacity =
      effectiveMachineCapacity(machine, day, calendarHours, flexHours) * targetRatio;
    const skillCapacity =
      effectiveSkillCapacity(skill, day, calendarHours, flexHours) * targetRatio;
    if (machineCapacity <= 0 || skillCapacity <= 0) continue;

    const machineLoad = machineBooked.get(operation.machineId)![day];
    const skillLoad = skillBooked.get(operation.skill)![day];
    fallback = {
      day,
      start: machineLoad,
      note: "Placed above target to keep routing complete",
    };

    if (
      machineLoad + operation.duration <= machineCapacity &&
      skillLoad + operation.skillHours <= skillCapacity
    ) {
      return { day, start: machineLoad, note: undefined };
    }
  }

  return fallback;
}

function findToolConflicts(blocks: PlanBlock[]) {
  const conflicts: Array<{
    toolId: string;
    tool: string;
    day: DayIndex;
    orders: string[];
  }> = [];

  tools.forEach((tool) => {
    days.forEach((_, dayIndex) => {
      const day = dayIndex as DayIndex;
      const toolBlocks = blocks.filter((item) => {
        const operation = getOperation(item);
        return item.day === day && operation?.toolId === tool.id;
      });

      const overlapping = new Set<string>();
      for (let index = 0; index < toolBlocks.length; index += 1) {
        for (let next = index + 1; next < toolBlocks.length; next += 1) {
          const first = toolBlocks[index];
          const second = toolBlocks[next];
          const overlap =
            first.start < second.start + second.duration &&
            second.start < first.start + first.duration;
          if (overlap && tool.quantity < 2) {
            overlapping.add(first.workOrderId);
            overlapping.add(second.workOrderId);
          }
        }
      }

      if (overlapping.size > 0) {
        conflicts.push({
          toolId: tool.id,
          tool: tool.label,
          day,
          orders: Array.from(overlapping),
        });
      }
    });
  });

  return conflicts;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

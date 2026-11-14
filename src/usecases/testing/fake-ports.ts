import type {
  Clock,
  PatientRecord,
  PatientRepository,
  StoredRound,
  RoundRepository,
  StoredPhq9,
  Phq9Repository,
  StoredGad7,
  Gad7Repository,
  StoredCall,
  CallRepository,
  StoredWarning,
  WarningRepository,
  StoredSmallDip,
  SmallDipRepository,
  StoredCrisisEvent,
  CrisisRepository,
  StoredBaselineNotWellNotice,
  BaselineNotWellRepository,
  StoredAccessLogEntry,
  AccessLogRepository,
  StoredExtraAnswer,
  ExtraAnswerRepository,
  UnitOfWork,
  Ports,
} from '../ports';
import { DEFAULT_EXTRA_ITEMS_CONFIG, type ExtraItemsConfig } from '../../domain/extra-items';

export class FakeClock implements Clock {
  constructor(private currentIso: string = '2026-11-16T18:00:00.000Z') {}

  now(): string {
    return this.currentIso;
  }

  setNow(iso: string): void {
    this.currentIso = iso;
  }
}

interface FakeStorageState {
  patients: Record<string, PatientRecord>;
  rounds: Record<string, StoredRound[]>;
  phq9: Record<string, StoredPhq9[]>;
  gad7: Record<string, StoredGad7[]>;
  calls: Record<string, StoredCall[]>;
  warnings: Record<string, StoredWarning[]>;
  smallDips: Record<string, StoredSmallDip[]>;
  crisis: Record<string, StoredCrisisEvent[]>;
  baselineNotWell: Record<string, StoredBaselineNotWellNotice[]>;
  accessLogs: StoredAccessLogEntry[];
  extraAnswers: Record<string, StoredExtraAnswer[]>;
}

function createEmptyState(): FakeStorageState {
  return {
    patients: {},
    rounds: {},
    phq9: {},
    gad7: {},
    calls: {},
    warnings: {},
    smallDips: {},
    crisis: {},
    baselineNotWell: {},
    accessLogs: [],
    extraAnswers: {},
  };
}

export class FakeStorageContext {
  public state: FakeStorageState = createEmptyState();

  cloneState(): FakeStorageState {
    return structuredClone(this.state);
  }

  restoreState(snapshot: FakeStorageState): void {
    this.state = snapshot;
  }
}

export class FakePatientRepository implements PatientRepository {
  constructor(private ctx: FakeStorageContext) {}

  async getPatient(patientId: string): Promise<PatientRecord | null> {
    return this.ctx.state.patients[patientId] ?? null;
  }

  async getPatientAccessSwitches(patientId: string) {
    const p = this.ctx.state.patients[patientId];
    if (!p) return null;
    return {
      patientId: p.patientId,
      clinicId: p.clinicId,
      consent: structuredClone(p.consent),
    };
  }

  async savePatient(record: PatientRecord): Promise<void> {
    this.ctx.state.patients[record.patientId] = structuredClone(record);
  }
}

export class FakeRoundRepository implements RoundRepository {
  constructor(private ctx: FakeStorageContext) {}

  async getRounds(patientId: string): Promise<readonly StoredRound[]> {
    const list = this.ctx.state.rounds[patientId] ?? [];
    return structuredClone(list).sort((a, b) => a.roundNumber - b.roundNumber);
  }

  async getRound(patientId: string, roundNumber: number): Promise<StoredRound | null> {
    const list = this.ctx.state.rounds[patientId] ?? [];
    const found = list.find((r) => r.roundNumber === roundNumber);
    return found ? structuredClone(found) : null;
  }

  async saveRound(round: StoredRound): Promise<void> {
    if (!this.ctx.state.rounds[round.patientId]) {
      this.ctx.state.rounds[round.patientId] = [];
    }
    const list = this.ctx.state.rounds[round.patientId];
    const idx = list.findIndex((r) => r.roundNumber === round.roundNumber);
    if (idx >= 0) {
      list[idx] = structuredClone(round);
    } else {
      list.push(structuredClone(round));
    }
  }
}

export class FakePhq9Repository implements Phq9Repository {
  public beforeSave: (() => Promise<void>) | null = null;

  constructor(private ctx: FakeStorageContext) {}

  async getPhq9s(patientId: string): Promise<readonly StoredPhq9[]> {
    const list = this.ctx.state.phq9[patientId] ?? [];
    return structuredClone(list).sort((a, b) => a.roundNumber - b.roundNumber);
  }

  async getCurrentPhq9(patientId: string): Promise<StoredPhq9 | null> {
    const list = this.ctx.state.phq9[patientId] ?? [];
    const unfinished = list.find((p) => p.progress === 'unfinished');
    if (unfinished) {
      return structuredClone(unfinished);
    }
    if (list.length === 0) return null;
    return structuredClone(list[list.length - 1]);
  }

  async savePhq9(assessment: StoredPhq9): Promise<void> {
    if (this.beforeSave) await this.beforeSave();
    if (!this.ctx.state.phq9[assessment.patientId]) {
      this.ctx.state.phq9[assessment.patientId] = [];
    }
    const list = this.ctx.state.phq9[assessment.patientId];
    const idx = list.findIndex((p) => p.roundNumber === assessment.roundNumber);
    if (idx >= 0) {
      list[idx] = structuredClone(assessment);
    } else {
      list.push(structuredClone(assessment));
    }
  }
}

export class FakeGad7Repository implements Gad7Repository {
  public beforeSave: (() => Promise<void>) | null = null;

  constructor(private ctx: FakeStorageContext) {}

  async getGad7s(patientId: string): Promise<readonly StoredGad7[]> {
    const list = this.ctx.state.gad7[patientId] ?? [];
    return structuredClone(list).sort((a, b) => a.roundNumber - b.roundNumber);
  }

  async saveGad7(assessment: StoredGad7): Promise<void> {
    if (this.beforeSave) await this.beforeSave();
    if (!this.ctx.state.gad7[assessment.patientId]) {
      this.ctx.state.gad7[assessment.patientId] = [];
    }
    const list = this.ctx.state.gad7[assessment.patientId];
    const idx = list.findIndex((g) => g.roundNumber === assessment.roundNumber);
    if (idx >= 0) {
      list[idx] = structuredClone(assessment);
    } else {
      list.push(structuredClone(assessment));
    }
  }
}

export class FakeCallRepository implements CallRepository {
  constructor(private ctx: FakeStorageContext) {}

  async getCalls(patientId: string): Promise<readonly StoredCall[]> {
    const list = this.ctx.state.calls[patientId] ?? [];
    return structuredClone(list);
  }

  async saveCall(call: StoredCall): Promise<void> {
    if (!this.ctx.state.calls[call.patientId]) {
      this.ctx.state.calls[call.patientId] = [];
    }
    this.ctx.state.calls[call.patientId].push(structuredClone(call));
  }
}

export class FakeWarningRepository implements WarningRepository {
  public beforeSave: (() => Promise<void>) | null = null;

  constructor(private ctx: FakeStorageContext) {}

  async getWarnings(patientId: string): Promise<readonly StoredWarning[]> {
    const list = this.ctx.state.warnings[patientId] ?? [];
    return structuredClone(list);
  }

  async saveWarning(warning: StoredWarning): Promise<void> {
    if (this.beforeSave) await this.beforeSave();
    if (!this.ctx.state.warnings[warning.patientId]) {
      this.ctx.state.warnings[warning.patientId] = [];
    }
    this.ctx.state.warnings[warning.patientId].push(structuredClone(warning));
  }
}

export class FakeSmallDipRepository implements SmallDipRepository {
  public beforeSave: (() => Promise<void>) | null = null;

  constructor(private ctx: FakeStorageContext) {}

  async getSmallDips(patientId: string): Promise<readonly StoredSmallDip[]> {
    const list = this.ctx.state.smallDips[patientId] ?? [];
    return structuredClone(list);
  }

  async saveSmallDip(dip: StoredSmallDip): Promise<void> {
    if (this.beforeSave) await this.beforeSave();
    if (!this.ctx.state.smallDips[dip.patientId]) {
      this.ctx.state.smallDips[dip.patientId] = [];
    }
    this.ctx.state.smallDips[dip.patientId].push(structuredClone(dip));
  }
}

export class FakeCrisisRepository implements CrisisRepository {
  constructor(private ctx: FakeStorageContext) {}

  async getCrisisEvents(patientId: string): Promise<readonly StoredCrisisEvent[]> {
    const list = this.ctx.state.crisis[patientId] ?? [];
    return structuredClone(list);
  }

  async saveCrisisEvent(event: StoredCrisisEvent): Promise<void> {
    if (!this.ctx.state.crisis[event.patientId]) {
      this.ctx.state.crisis[event.patientId] = [];
    }
    this.ctx.state.crisis[event.patientId].push(structuredClone(event));
  }
}

export class FakeBaselineNotWellRepository implements BaselineNotWellRepository {
  constructor(private ctx: FakeStorageContext) {}

  async getNotices(patientId: string): Promise<readonly StoredBaselineNotWellNotice[]> {
    const list = this.ctx.state.baselineNotWell[patientId] ?? [];
    return structuredClone(list);
  }

  async saveNotice(notice: StoredBaselineNotWellNotice): Promise<void> {
    if (!this.ctx.state.baselineNotWell[notice.patientId]) {
      this.ctx.state.baselineNotWell[notice.patientId] = [];
    }
    this.ctx.state.baselineNotWell[notice.patientId].push(structuredClone(notice));
  }
}

export class FakeAccessLogRepository implements AccessLogRepository {
  constructor(private ctx: FakeStorageContext) {}

  async appendLog(entry: StoredAccessLogEntry): Promise<void> {
    this.ctx.state.accessLogs.push(structuredClone(entry));
  }

  async getLogs(patientId?: string): Promise<readonly StoredAccessLogEntry[]> {
    const logs = structuredClone(this.ctx.state.accessLogs);
    if (!patientId) return logs;
    return logs.filter((l) => l.target.patientId === patientId);
  }
}

export class FakeExtraAnswerRepository implements ExtraAnswerRepository {
  constructor(private ctx: FakeStorageContext) {}

  async getExtraAnswers(patientId: string): Promise<readonly StoredExtraAnswer[]> {
    const list = this.ctx.state.extraAnswers[patientId] ?? [];
    return structuredClone(list).sort((a, b) => a.roundNumber - b.roundNumber);
  }

  async getExtraAnswer(patientId: string, roundNumber: number): Promise<StoredExtraAnswer | null> {
    const list = this.ctx.state.extraAnswers[patientId] ?? [];
    const found = list.find((a) => a.roundNumber === roundNumber);
    return found ? structuredClone(found) : null;
  }

  async saveExtraAnswer(answer: StoredExtraAnswer): Promise<void> {
    if (!this.ctx.state.extraAnswers[answer.patientId]) {
      this.ctx.state.extraAnswers[answer.patientId] = [];
    }
    const list = this.ctx.state.extraAnswers[answer.patientId];
    const idx = list.findIndex((a) => a.roundNumber === answer.roundNumber);
    if (idx >= 0) {
      list[idx] = structuredClone(answer);
    } else {
      list.push(structuredClone(answer));
    }
  }
}

export class FakeUnitOfWork implements UnitOfWork {
  public failNext = false;
  private activePromise: Promise<void> | null = null;

  constructor(private ctx: FakeStorageContext) {}

  async execute<T>(work: () => Promise<T>): Promise<T> {
    while (this.activePromise) {
      await this.activePromise;
    }
    
    let resolveActive!: () => void;
    this.activePromise = new Promise((resolve) => { resolveActive = resolve; });

    if (this.failNext) {
      this.failNext = false;
      resolveActive();
      this.activePromise = null;
      throw new Error('Unit of work injected failure before execution');
    }

    const snapshot = this.ctx.cloneState();
    try {
      const result = await work();
      if (this.failNext) {
        this.failNext = false;
        throw new Error('Unit of work injected failure after execution');
      }
      return result;
    } catch (error) {
      this.ctx.restoreState(snapshot);
      throw error;
    } finally {
      resolveActive();
      this.activePromise = null;
    }
  }
}

export function createFakePorts(
  initialClockIso: string = '2026-11-16T18:00:00.000Z',
  extraItemsConfig: ExtraItemsConfig = DEFAULT_EXTRA_ITEMS_CONFIG
): {
  ports: Ports;
  clock: FakeClock;
  ctx: FakeStorageContext;
  unitOfWork: FakeUnitOfWork;
} {
  const clock = new FakeClock(initialClockIso);
  const ctx = new FakeStorageContext();
  const unitOfWork = new FakeUnitOfWork(ctx);

  const ports: Ports = {
    clock,
    patients: new FakePatientRepository(ctx),
    rounds: new FakeRoundRepository(ctx),
    phq9: new FakePhq9Repository(ctx),
    gad7: new FakeGad7Repository(ctx),
    calls: new FakeCallRepository(ctx),
    warnings: new FakeWarningRepository(ctx),
    smallDips: new FakeSmallDipRepository(ctx),
    crisis: new FakeCrisisRepository(ctx),
    baselineNotWell: new FakeBaselineNotWellRepository(ctx),
    accessLog: new FakeAccessLogRepository(ctx),
    extraAnswers: new FakeExtraAnswerRepository(ctx),
    extraItemsConfig,
    unitOfWork,
  };

  return { ports, clock, ctx, unitOfWork };
}

export {
  SimulatedFinnishEidProvider,
  simulatedFinnishEidProvider,
  type StrongEidProvider,
  type ParticipantIdResolver,
} from "./eid-provider";
export {
  requireApiSession,
  requirePatientPageSession,
  requireStaffPageSession,
  type ApiSessionResult,
} from "./guards";
export {
  authenticateStaffCredentials,
  getStaffSecondFactorKind,
  type StaffAuthResult,
  type StaffCredentialsInput,
  type StaffSecondFactorKind,
  type StaffIdResolver,
} from "./staff-auth";
export {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  applySessionCookie,
  clearSessionCookie,
  readServerSession,
  readSessionFromRequest,
  sealSession,
  sessionToActor,
  unsealSession,
} from "./session";

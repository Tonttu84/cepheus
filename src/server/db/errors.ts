/** A patient record names a clinic that is not stored. Clinics are never created here. */
export class UnknownClinicError extends Error {
  constructor() {
    super("Clinic not found");
    this.name = "UnknownClinicError";
  }
}

/** A value read back from the database does not have the shape this code wrote. */
export class StoredDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoredDataError";
  }
}

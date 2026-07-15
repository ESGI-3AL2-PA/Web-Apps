export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: "user" | "admin" | "superAdmin";
  address: string;
  districtId: string;
  balance: number;
  banned?: boolean;
  emailVerified: boolean;
  totpSecret: string | null;
  totpEnabled: boolean;
  // Preferred language for transactional emails; missing is treated as "fr".
  lang?: "fr" | "en";
  // Highest TOTP time-step already consumed; used to reject replay of a code within its window.
  lastTotpStep?: number;
  createdAt: string;
  updatedAt: string;
}

export interface IUserReaderRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  setEmailVerified(userId: string): Promise<void>;
  setPasswordHash(userId: string, passwordHash: string): Promise<void>;
  setTotpSecret(userId: string, secret: string | null, enabled: boolean): Promise<void>;
  /**
   * Atomically claim a TOTP time-step. Returns true only if the user had not already consumed a
   * step >= the given one, making a TOTP code single-use even under concurrent requests.
   */
  consumeTotpStep(userId: string, step: number): Promise<boolean>;
}

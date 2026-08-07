import {
  existsSync,
  mkdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import path from "node:path";

import { protectPrivateFile } from "./file-security.mjs";
import { CREDENTIAL_SOURCE_POLICY_PATH } from "./paths.mjs";

export function readCredentialSourcePolicy() {
  if (!existsSync(CREDENTIAL_SOURCE_POLICY_PATH)) return { version: 1 };
  try {
    const policy = JSON.parse(readFileSync(CREDENTIAL_SOURCE_POLICY_PATH, "utf8"));
    if (
      policy?.version !== 1 ||
      (policy.windowsUserEnvironment !== undefined &&
        typeof policy.windowsUserEnvironment !== "boolean")
    ) {
      throw new Error("invalid policy");
    }
    return policy;
  } catch {
    throw new Error(`Invalid credential source policy at ${CREDENTIAL_SOURCE_POLICY_PATH}.`);
  }
}

export function windowsUserEnvironmentEnabled() {
  return readCredentialSourcePolicy().windowsUserEnvironment === true;
}

export function writeCredentialSourcePolicy({ windowsUserEnvironment }) {
  if (typeof windowsUserEnvironment !== "boolean") {
    throw new Error("Windows user-environment policy must be enabled or disabled explicitly.");
  }
  mkdirSync(path.dirname(CREDENTIAL_SOURCE_POLICY_PATH), {
    recursive: true,
    mode: 0o700,
  });
  const temporary = `${CREDENTIAL_SOURCE_POLICY_PATH}.tmp.${process.pid}`;
  writeFileSync(
    temporary,
    `${JSON.stringify({ version: 1, windowsUserEnvironment }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  try {
    protectPrivateFile(temporary);
    renameSync(temporary, CREDENTIAL_SOURCE_POLICY_PATH);
    protectPrivateFile(CREDENTIAL_SOURCE_POLICY_PATH);
  } catch (error) {
    if (existsSync(temporary)) unlinkSync(temporary);
    throw error;
  }
}

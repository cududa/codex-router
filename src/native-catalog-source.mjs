import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { protectPrivateFile } from "./file-security.mjs";
import { MODEL_BY_SLUG } from "./model-registry.mjs";
import { NATIVE_CATALOG_SOURCE_PATH } from "./paths.mjs";

function validCatalog(catalog) {
  return (
    catalog &&
    Array.isArray(catalog.models) &&
    catalog.models.length > 0 &&
    catalog.models.every(
      (model) =>
        model &&
        typeof model.slug === "string" &&
        model.slug &&
        !MODEL_BY_SLUG.has(model.slug),
    )
  );
}

export function readNativeCatalogFile(catalogPath) {
  if (!path.isAbsolute(catalogPath) || !existsSync(catalogPath)) return undefined;
  try {
    const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
    return validCatalog(catalog) ? catalog : undefined;
  } catch {
    return undefined;
  }
}

export function readNativeCatalogSource() {
  if (!existsSync(NATIVE_CATALOG_SOURCE_PATH)) return undefined;
  try {
    const state = JSON.parse(readFileSync(NATIVE_CATALOG_SOURCE_PATH, "utf8"));
    if (
      state?.version !== 1 ||
      typeof state.path !== "string" ||
      !path.isAbsolute(state.path)
    ) {
      throw new Error("invalid state");
    }
    return state;
  } catch {
    throw new Error(`Invalid native catalog source state at ${NATIVE_CATALOG_SOURCE_PATH}.`);
  }
}

export function writeNativeCatalogSource(catalogPath) {
  if (!readNativeCatalogFile(catalogPath)) {
    throw new Error(`Refusing to adopt an invalid native model catalog: ${catalogPath}`);
  }
  mkdirSync(path.dirname(NATIVE_CATALOG_SOURCE_PATH), { recursive: true, mode: 0o700 });
  const temporary = `${NATIVE_CATALOG_SOURCE_PATH}.tmp.${process.pid}`;
  writeFileSync(
    temporary,
    `${JSON.stringify({ version: 1, path: catalogPath }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  try {
    protectPrivateFile(temporary);
    renameSync(temporary, NATIVE_CATALOG_SOURCE_PATH);
    protectPrivateFile(NATIVE_CATALOG_SOURCE_PATH);
  } catch (error) {
    if (existsSync(temporary)) unlinkSync(temporary);
    throw error;
  }
}

export function clearNativeCatalogSource() {
  if (existsSync(NATIVE_CATALOG_SOURCE_PATH)) unlinkSync(NATIVE_CATALOG_SOURCE_PATH);
}

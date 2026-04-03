import { DatabaseManager } from "../../src/database-manager.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function createTestManager(): {
  manager: DatabaseManager;
  tmpDir: string;
  cleanup: () => void;
} {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "databook-test-"));
  const manager = new DatabaseManager(tmpDir);
  return {
    manager,
    tmpDir,
    cleanup: () => {
      manager.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}

const MAX_ENTRIES = 20;

let entries: string[] = [];

export function logAction(description: string) {
  entries = [...entries, description].slice(-MAX_ENTRIES);
}

export function getRecentActions(): string[] {
  return entries;
}

/** Test-only: resets the module-scoped log between test cases. */
export function resetActionLogForTests() {
  entries = [];
}

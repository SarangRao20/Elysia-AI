import fs from "fs/promises";
import { Reminder } from "./src/lib/reminderTypes";
import { dataFile } from "./server_paths";

const REMINDERS_FILE = dataFile("reminders.json");

// In-memory store — loaded on boot, persisted on every mutation.
let reminders: Reminder[] = [];

/** Callback fired when a reminder is due. Set by server.ts to send WS messages. */
export let onReminderFired: ((r: Reminder) => void) | null = null;

export function setOnReminderFired(cb: (r: Reminder) => void): void {
  onReminderFired = cb;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export async function loadReminders(): Promise<Reminder[]> {
  try {
    const data = await fs.readFile(REMINDERS_FILE, "utf-8");
    reminders = JSON.parse(data) as Reminder[];
    return reminders;
  } catch (error: any) {
    if (error.code === "ENOENT") {
      reminders = [];
      return [];
    }
    console.error("[Reminder] Error loading reminders:", error);
    reminders = [];
    return [];
  }
}

async function saveReminders(): Promise<void> {
  try {
    await fs.writeFile(REMINDERS_FILE, JSON.stringify(reminders, null, 2), "utf-8");
  } catch (error) {
    console.error("[Reminder] Error saving reminders:", error);
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function addReminder(text: string, minutes: number): Reminder {
  const id = Math.random().toString(36).substring(2, 11);
  const now = new Date();
  const fireAt = new Date(now.getTime() + minutes * 60 * 1000);

  const reminder: Reminder = {
    id,
    text,
    fireAt: fireAt.toISOString(),
    createdAt: now.toISOString(),
    fired: false,
  };

  reminders.push(reminder);
  void saveReminders();
  console.log(`[Reminder] Scheduled "${text}" in ${minutes} min (id=${id})`);
  return reminder;
}

export function getReminders(): Reminder[] {
  return [...reminders];
}

export function cancelReminder(id: string): boolean {
  const idx = reminders.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  reminders.splice(idx, 1);
  void saveReminders();
  console.log(`[Reminder] Cancelled id=${id}`);
  return true;
}

// ---------------------------------------------------------------------------
// Timer — checks every 30 seconds for due reminders
// ---------------------------------------------------------------------------

let timer: ReturnType<typeof setInterval> | null = null;

export function startReminderTimer(): void {
  if (timer) return;
  console.log("[Reminder] Timer started (checking every 30s)");
  timer = setInterval(() => {
    const now = Date.now();
    for (const r of reminders) {
      if (!r.fired && new Date(r.fireAt).getTime() <= now) {
        r.fired = true;
        void saveReminders();
        console.log(`[Reminder] FIRED: "${r.text}"`);
        onReminderFired?.(r);
      }
    }
    // Clean up fired reminders older than 5 minutes
    reminders = reminders.filter((r) => {
      if (!r.fired) return true;
      return now - new Date(r.fireAt).getTime() < 5 * 60 * 1000;
    });
  }, 30_000);
}

export function stopReminderTimer(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

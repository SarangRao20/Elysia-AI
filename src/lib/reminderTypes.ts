export interface Reminder {
  id: string;
  text: string;
  /** ISO timestamp when the reminder should fire. */
  fireAt: string;
  createdAt: string;
  /** Whether this reminder has been fired. */
  fired: boolean;
}

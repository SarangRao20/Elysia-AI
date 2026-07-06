export interface Memory {
  id: string;
  category: "identity" | "preference" | "goal" | "project" | "relationship" | "emotional" | "behavior";
  text: string;
  createdAt: string;
  updatedAt: string;
}

export type MemoryCategory = Memory["category"];

export interface MemoryTransaction {
  action: "ADD" | "UPDATE" | "REMOVE";
  id: string;
  category: MemoryCategory;
  text: string;
}

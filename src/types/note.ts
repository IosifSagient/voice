export type ActionItem = {
  id?: string;
  text: string;
  due_date: string | null;
  due_time?: string | null;
  all_day?: boolean;
  status?: string;
  calendar_event_id?: string | null;
};

export type Note = {
  id: string;
  timestamp: number;
  summary: string;
  people: string[];
  topics: string[];       // kept for edit-form backward compat; mirrors products on new notes
  products: string[];
  companies: string[];
  decisions: string[];    // kept for old notes; new extractions produce []
  action_items: ActionItem[];
  transcript: string;
  openActionCount?: number;
};

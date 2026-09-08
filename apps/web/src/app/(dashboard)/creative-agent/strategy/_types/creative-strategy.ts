export type StrategySource = 'MANUAL' | 'AUTO_ENROLMENT';

export type StrategyEntry = {
  id: string;
  /** YYYY-MM-DD — the day the change took effect, not the day it was typed. */
  date: string;
  title: string;
  description: string | null;
  tag: string;
  result: string | null;
  resultUpdatedAt: string | null;
  source: StrategySource;
  creativeCode: string | null;
  creativeTitle: string | null;
  author: { id: string; name: string };
  /** Only the author gets the result and delete controls. */
  isMine: boolean;
  createdAt: string;
};

export type StrategyTagOption = { value: string; label: string };

export type StrategyLogResponse = {
  entries: StrategyEntry[];
  tags: StrategyTagOption[];
  /** Today in Manila, from the server — the date input must not drift on a
   *  laptop set to another timezone. */
  today: string;
  showsOthers: boolean;
};

export type CreateStrategyEntryInput = {
  date: string;
  title: string;
  description?: string;
  tag: string;
  creativeCode?: string;
};

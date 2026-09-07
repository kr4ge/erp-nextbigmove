/**
 * The creator segment of a Meta ad name.
 *
 * Shortest label that still identifies one person inside a tenant:
 *   - first name alone when nobody else in the tenant shares it
 *   - "First L." when the initial separates them
 *   - "First Last" only when even the initial collides
 *
 * The same function decides the label that goes INTO ad names (enrollment,
 * copy buttons) and the key that reads it back OUT (KPI attribution), so the
 * two can never drift.
 */
export type NamedUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email?: string | null;
};

function firstNameOf(user: NamedUser): string {
  const first = user.firstName?.trim();
  if (first) return first;
  const local = user.email?.split('@')[0]?.trim();
  return local || 'Creator';
}

export function buildAdNameCreatorLabels(users: NamedUser[]): Map<string, string> {
  const byFirst = new Map<string, NamedUser[]>();
  for (const user of users) {
    const key = firstNameOf(user).toLowerCase();
    byFirst.set(key, [...(byFirst.get(key) ?? []), user]);
  }

  const labels = new Map<string, string>();
  for (const group of byFirst.values()) {
    if (group.length === 1) {
      labels.set(group[0].id, firstNameOf(group[0]));
      continue;
    }
    // Same first name: try the initial, then the full surname.
    const byInitial = new Map<string, NamedUser[]>();
    for (const user of group) {
      const initial = (user.lastName?.trim()[0] ?? '').toLowerCase();
      byInitial.set(initial, [...(byInitial.get(initial) ?? []), user]);
    }
    for (const user of group) {
      const first = firstNameOf(user);
      const last = user.lastName?.trim() ?? '';
      const initial = last[0] ?? '';
      const initialUnique = initial && (byInitial.get(initial.toLowerCase())?.length ?? 0) === 1;
      labels.set(user.id, initialUnique ? `${first} ${initial.toUpperCase()}.` : last ? `${first} ${last}` : first);
    }
  }
  return labels;
}

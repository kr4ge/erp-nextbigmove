import { FIELD_CLASS } from '../constants';
import type { TeamOption } from '../types';

type HeaderFiltersProps = {
  selectedTeamCode: string;
  filterStartDate: string;
  filterEndDate: string;
  teamOptions: TeamOption[];
  onTeamCodeChange: (value: string) => void;
  onFilterStartDateChange: (value: string) => void;
  onFilterEndDateChange: (value: string) => void;
};

export function HeaderFilters({
  selectedTeamCode,
  filterStartDate,
  filterEndDate,
  teamOptions,
  onTeamCodeChange,
  onFilterStartDateChange,
  onFilterEndDateChange,
}: HeaderFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={selectedTeamCode}
        onChange={(event) => onTeamCodeChange(event.target.value)}
        className={`${FIELD_CLASS} shadow-sm`}
      >
        <option value="">Select team</option>
        {teamOptions.map((team) => (
          <option key={team.id} value={team.teamCode}>
            {team.name} ({team.teamCode})
          </option>
        ))}
      </select>

      <input
        type="date"
        value={filterStartDate}
        onChange={(event) => onFilterStartDateChange(event.target.value)}
        className={`${FIELD_CLASS} shadow-sm`}
      />

      <input
        type="date"
        value={filterEndDate}
        onChange={(event) => onFilterEndDateChange(event.target.value)}
        className={`${FIELD_CLASS} shadow-sm`}
      />
    </div>
  );
}

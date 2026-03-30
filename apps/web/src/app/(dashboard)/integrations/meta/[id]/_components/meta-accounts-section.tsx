'use client';

import type { MetaAdAccount } from '../types';

interface MetaAccountsSectionProps {
  adAccounts: MetaAdAccount[];
  paginatedAccounts: MetaAdAccount[];
  page: number;
  pageSize: number;
  canPrev: boolean;
  canNext: boolean;
  selectedAccounts: string[];
  allEligibleSelected: boolean;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleAccount: (accountId: string, checked: boolean) => void;
  onOpenMultiplierModal: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  getAccountStatusText: (status: number | null) => string;
  getAccountStatusColor: (status: number | null) => string;
  formatDate: (date: string | null) => string;
}

export function MetaAccountsSection({
  adAccounts,
  paginatedAccounts,
  page,
  pageSize,
  canPrev,
  canNext,
  selectedAccounts,
  allEligibleSelected,
  onToggleSelectAll,
  onToggleAccount,
  onOpenMultiplierModal,
  onPrevPage,
  onNextPage,
  getAccountStatusText,
  getAccountStatusColor,
  formatDate,
}: MetaAccountsSectionProps) {
  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0">
      <div className="bg-white shadow-sm rounded-2xl border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Ad Accounts ({adAccounts.length})</h2>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
                  checked={allEligibleSelected}
                  onChange={(e) => onToggleSelectAll(e.target.checked)}
                />
                <span>Select all non-PHP</span>
              </label>
              <button
                type="button"
                onClick={onOpenMultiplierModal}
                disabled={selectedAccounts.length === 0}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add currency multiplier
              </button>
            </div>
          </div>
        </div>

        {adAccounts.length === 0 ? (
          <div className="p-8 text-center text-slate-500 flex-1 flex items-center justify-center">
            No ad accounts synced yet. Click "Sync Ad Accounts" to fetch them.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto flex-1">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Select</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Account ID</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Name</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Currency</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Multiplier</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Timezone</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Status</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Last Sync</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedAccounts.map((account) => {
                    const isPhp = (account.currency || '').toUpperCase() === 'PHP';
                    const selected = selectedAccounts.includes(account.accountId);
                    return (
                      <tr key={account.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {!isPhp ? (
                            <input
                              type="checkbox"
                              className="rounded border-slate-300"
                              checked={selected}
                              onChange={(e) => onToggleAccount(account.accountId, e.target.checked)}
                            />
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-900">
                          <div className="max-w-[150px] truncate" title={account.accountId}>
                            {account.accountId}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm font-semibold text-slate-900">
                          <div className="max-w-[200px] truncate" title={account.name}>
                            {account.name}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {account.currency || 'N/A'}
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {account.currencyMultiplier != null ? Number(account.currencyMultiplier).toFixed(4) : '—'}
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          <div className="max-w-[150px] truncate" title={account.timezone || 'N/A'}>
                            {account.timezone || 'N/A'}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getAccountStatusColor(account.accountStatus)}`}
                          >
                            {getAccountStatusText(account.accountStatus)}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          <div className="min-w-[120px]">{formatDate(account.lastSyncAt)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex-shrink-0">
              <p className="text-sm text-slate-600">
                Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, adAccounts.length)} of {adAccounts.length}
              </p>
              <div className="flex gap-2">
                <button
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  onClick={onPrevPage}
                  disabled={!canPrev}
                >
                  Previous
                </button>
                <button
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  onClick={onNextPage}
                  disabled={!canNext}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


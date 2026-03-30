'use client';

interface MetaDetailHeaderProps {
  name: string;
  activeTab: 'accounts' | 'insights';
  onActiveTabChange: (tab: 'accounts' | 'insights') => void;
  onBack: () => void;
  onTestConnection: () => void;
  onSyncAccounts: () => void;
  isSyncing: boolean;
}

export function MetaDetailHeader({
  name,
  activeTab,
  onActiveTabChange,
  onBack,
  onTestConnection,
  onSyncAccounts,
  isSyncing,
}: MetaDetailHeaderProps) {
  return (
    <div className="flex-shrink-0">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center text-sm text-slate-500 transition-colors hover:text-slate-700"
      >
        <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Meta Integrations
      </button>

      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{name}</h1>
          <p className="mt-1 text-sm text-slate-500 sm:mt-2 sm:text-base">
            View and manage ad accounts for this integration
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <button
            onClick={onTestConnection}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Test Connection
          </button>
          <button
            onClick={onSyncAccounts}
            disabled={isSyncing}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSyncing ? 'Syncing...' : 'Sync Ad Accounts'}
          </button>
        </div>
      </div>

      <div className="-mx-4 mt-6 overflow-x-auto border-b border-slate-200 px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-4 sm:min-w-0">
          <button
            className={`whitespace-nowrap px-3 pb-3 text-sm font-semibold transition-colors ${
              activeTab === 'accounts'
                ? 'border-b-2 border-blue-600 text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => onActiveTabChange('accounts')}
          >
            Ad Accounts
          </button>
          <button
            className={`whitespace-nowrap px-3 pb-3 text-sm font-semibold transition-colors ${
              activeTab === 'insights'
                ? 'border-b-2 border-blue-600 text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => onActiveTabChange('insights')}
          >
            Ad Insights
          </button>
        </div>
      </div>
    </div>
  );
}

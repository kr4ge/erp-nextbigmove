'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IntegrationTeamAssignmentFields } from './integration-team-assignment-fields';
import type { PosShopOption, TeamOption } from '../_types/integration-management';
import type { IntegrationProvider } from '../types';

interface IntegrationConnectModalProps {
  isOpen: boolean;
  provider: IntegrationProvider | null;
  isSubmitting: boolean;
  teams: TeamOption[];
  isAdmin: boolean;
  canShareIntegrations: boolean;
  integrationTeamId: string;
  sharedTeamIds: string[];
  metaAccessToken: string;
  posApiKey: string;
  posDescription: string;
  posShops: PosShopOption[];
  posSelectedShopId: string;
  ownerTeamId: string | null;
  onClose: () => void;
  onTeamIdChange: (teamId: string) => void;
  onToggleSharedTeam: (teamId: string) => void;
  onMetaAccessTokenChange: (value: string) => void;
  onPosApiKeyChange: (value: string) => void;
  onPosDescriptionChange: (value: string) => void;
  onPosSelectedShopIdChange: (value: string) => void;
  onMetaSubmit: (e: React.FormEvent) => void;
  onPosSubmit: (e: React.FormEvent) => void;
  onPosShopSelect: (e: React.FormEvent) => void;
}

export function IntegrationConnectModal({
  isOpen,
  provider,
  isSubmitting,
  teams,
  isAdmin,
  canShareIntegrations,
  integrationTeamId,
  sharedTeamIds,
  metaAccessToken,
  posApiKey,
  posDescription,
  posShops,
  posSelectedShopId,
  ownerTeamId,
  onClose,
  onTeamIdChange,
  onToggleSharedTeam,
  onMetaAccessTokenChange,
  onPosApiKeyChange,
  onPosDescriptionChange,
  onPosSelectedShopIdChange,
  onMetaSubmit,
  onPosSubmit,
  onPosShopSelect,
}: IntegrationConnectModalProps) {
  if (!isOpen || !provider) return null;

  const labelClass = 'block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500';
  const inputClass =
    'mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-orange-200 focus:border-orange-300 focus:ring-4 focus:ring-orange-100';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pl-6 pr-3 py-4">
          <div>
            <p className="text-xs-tight font-semibold uppercase tracking-[0.2em] text-primary">
              Integrations
            </p>
            <h2 className="text-xl font-semibold text-[#0F172A]">
              {provider === 'META_ADS' ? 'Meta Marketing API' : 'Pancake POS'}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="md"
            onClick={onClose}
            aria-label="Close dialog"
            className="h-10 w-10 px-0"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-4 px-6 py-4">
          {provider === 'META_ADS' && (
            <form onSubmit={onMetaSubmit} className="space-y-4">
              <IntegrationTeamAssignmentFields
                teamId={integrationTeamId}
                teams={teams}
                isAdmin={isAdmin}
                canShareIntegrations={canShareIntegrations}
                sharedTeamIds={sharedTeamIds}
                ownerTeamId={ownerTeamId}
                onTeamIdChange={onTeamIdChange}
                onToggleSharedTeam={onToggleSharedTeam}
              />

              <div>
                <label className={labelClass}>Access Token</label>
                <input
                  type="password"
                  value={metaAccessToken}
                  onChange={(e) => onMetaAccessTokenChange(e.target.value)}
                  className={inputClass}
                  required
                  placeholder="Meta access token"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button variant="ghost" type="button" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  loading={isSubmitting}
                >
                  {isSubmitting ? 'Connecting...' : 'Connect'}
                </Button>
              </div>
            </form>
          )}

          {provider === 'PANCAKE_POS' && (
            <form onSubmit={posShops.length > 1 ? onPosShopSelect : onPosSubmit} className="space-y-4">
              <IntegrationTeamAssignmentFields
                teamId={integrationTeamId}
                teams={teams}
                isAdmin={isAdmin}
                canShareIntegrations={canShareIntegrations}
                sharedTeamIds={sharedTeamIds}
                ownerTeamId={ownerTeamId}
                onTeamIdChange={onTeamIdChange}
                onToggleSharedTeam={onToggleSharedTeam}
              />

              <div>
                <label className={labelClass}>API Key</label>
                <input
                  type="password"
                  value={posApiKey}
                  onChange={(e) => onPosApiKeyChange(e.target.value)}
                  className={inputClass}
                  required
                  placeholder="Pancake POS API key"
                />
              </div>

              <div>
                <label className={labelClass}>Description (Optional)</label>
                <textarea
                  value={posDescription}
                  onChange={(e) => onPosDescriptionChange(e.target.value)}
                  className={inputClass}
                  rows={2}
                  placeholder="Describe this store"
                />
              </div>

              {posShops.length > 1 && (
                <div>
                  <label className={labelClass}>Select Shop</label>
                  <select
                    value={posSelectedShopId}
                    onChange={(e) => onPosSelectedShopIdChange(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Choose a shop</option>
                    {posShops.map((shop) => (
                      <option key={shop.id} value={shop.id}>
                        {shop.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button variant="ghost" type="button" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  loading={isSubmitting}
                >
                  {isSubmitting ? 'Connecting...' : posShops.length > 1 ? 'Create Store' : 'Fetch Shops'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

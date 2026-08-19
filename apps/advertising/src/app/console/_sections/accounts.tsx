'use client';

import { CreditCard } from 'lucide-react';
import { peso } from '../_lib/format';
import type { AdAccountRow } from '../_lib/types';

export function AccountsSection({
  accounts,
  loading,
}: {
  accounts: AdAccountRow[];
  loading: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section className="panel panel-content">
        <div className="panel-header flex items-center gap-2">
          <CreditCard className="panel-icon" />
          <h4 className="panel-title">Ad accounts ({accounts.length})</h4>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-secondary/30">
              <tr>
                <th className="px-5 py-3 text-xs-tight font-medium uppercase text-muted">Account</th>
                <th className="px-5 py-3 text-xs-tight font-medium uppercase text-muted">Meta ID</th>
                <th className="px-5 py-3 text-xs-tight font-medium uppercase text-muted">Status</th>
                <th className="px-5 py-3 text-xs-tight font-medium uppercase text-muted">Spend</th>
                <th className="px-5 py-3 text-xs-tight font-medium uppercase text-muted">Orders</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-muted">Loading…</td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-muted">
                    No Meta ad accounts connected to this workspace yet.
                  </td>
                </tr>
              ) : (
                accounts.map((account) => (
                  <tr key={account.id} className="border-b border-border/10 hover:bg-secondary/20">
                    <td className="px-5 py-3.5 text-sm-custom font-medium text-foreground">
                      {account.name}
                    </td>
                    <td className="px-5 py-3.5 text-sm-custom text-muted">{account.accountId}</td>
                    <td className="px-5 py-3.5">
                      <span className={account.enabled ? 'pill pill-primary' : 'pill pill-neutral'}>
                        {account.enabled ? account.status : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm-custom text-foreground">{peso(account.spend)}</td>
                    <td className="px-5 py-3.5 text-sm-custom text-foreground">{account.purchases}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel panel-content">
        <div className="panel-header flex items-center gap-2">
          <CreditCard className="panel-icon" />
          <h4 className="panel-title">Payment methods</h4>
        </div>
        <div className="flex flex-col gap-3 p-6">
          <p className="text-base text-foreground">Not built yet.</p>
          <p className="max-w-prose text-sm text-muted">
            Which card pays for which ad account, who holds it, and when it expires — so a
            declined card is caught before it pauses a campaign.
          </p>
          <p className="max-w-prose text-sm text-muted">
            <span className="font-medium text-foreground">What it needs:</span> a payment method
            model and a vault for the account credentials. Neither exists in the ERP today.
          </p>
        </div>
      </section>
    </div>
  );
}

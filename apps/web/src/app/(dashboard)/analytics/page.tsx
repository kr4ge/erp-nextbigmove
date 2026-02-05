'use client';

import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { BarChart3, TrendingUp, ShoppingCart, LineChart } from 'lucide-react';
import Link from 'next/link';

export default function AnalyticsLandingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Choose a report area to view insights and performance metrics."
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Link href="/analytics/sales">
          <Card className="cursor-pointer transition-all hover:border-[#CBD5E1] hover:shadow-md">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ECFDF3] text-[#10B981]">
                <ShoppingCart className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#0F172A]">Sales Analytics</h2>
                <p className="mt-1 text-sm text-[#475569]">
                  View sales performance, revenue trends, and transaction data from your POS integrations.
                </p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/analytics/sales-performance">
          <Card className="cursor-pointer transition-all hover:border-[#CBD5E1] hover:shadow-md">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#3B82F6]">
                <LineChart className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#0F172A]">Sales Performance</h2>
                <p className="mt-1 text-sm text-[#475569]">
                  Track performance by sales assignee and shop to see upsell impact over time.
                </p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/analytics/marketing">
          <Card className="cursor-pointer transition-all hover:border-[#CBD5E1] hover:shadow-md">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#0F172A]">Marketing Analytics</h2>
                <p className="mt-1 text-sm text-[#475569]">
                  Track ad campaign performance, spend metrics, and ROI from Meta Ads integrations.
                </p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      <Card className="border-dashed">
        <div className="flex items-center gap-4 text-[#94A3B8]">
          <BarChart3 className="h-8 w-8" />
          <div>
            <p className="font-medium text-[#475569]">More analytics coming soon</p>
            <p className="text-sm">
              Additional dashboards and reports will be available as you connect more integrations.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

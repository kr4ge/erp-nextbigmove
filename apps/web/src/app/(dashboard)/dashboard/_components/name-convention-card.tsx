"use client";

import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardSection } from "./dashboard-section";

interface NameConventionCardProps {
  teamCode: string;
  teamCodeLoading: boolean;
  employeeId?: string | null;
}

export function NameConventionCard({
  teamCode,
  teamCodeLoading,
  employeeId,
}: NameConventionCardProps) {
  const [nameTab, setNameTab] = useState<"ads" | "campaign">("ads");
  const [adsInputs, setAdsInputs] = useState<{
    f1: string;
    f2: string;
    f5: string;
  }>({ f1: "", f2: "", f5: "" });
  const [campaignInputs, setCampaignInputs] = useState<{
    type: string;
    emp: string;
    shop: string;
    product: string;
    mapping: string;
    date: string;
  }>({ type: "", emp: "", shop: "", product: "", mapping: "", date: "" });
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameResult, setNameResult] = useState("");

  useEffect(() => {
    setNameError(null);
    setNameResult("");
  }, [nameTab]);

  const generateName = () => {
    setNameError(null);
    if (nameTab === "ads") {
      const fields = [
        adsInputs.f1,
        adsInputs.f2,
        teamCode,
        employeeId || "",
        adsInputs.f5,
      ];
      if (fields.some((f) => !f || f.trim().length === 0)) {
        setNameError("All fields are required.");
        setNameResult("");
        return;
      }
      if (fields.some((f) => f.includes("_"))) {
        setNameError("Inputs cannot contain underscores (_).");
        setNameResult("");
        return;
      }
      setNameResult(fields.map((f) => f.trim()).join("_"));
      return;
    }

    const fields = [
      campaignInputs.type,
      campaignInputs.emp || employeeId || "",
      campaignInputs.shop,
      campaignInputs.product,
      campaignInputs.mapping,
      campaignInputs.date,
    ];
    if (fields.some((f) => !f || f.trim().length === 0)) {
      setNameError("All fields are required.");
      setNameResult("");
      return;
    }
    if (fields.some((f) => f.includes("_"))) {
      setNameError("Inputs cannot contain underscores (_).");
      setNameResult("");
      return;
    }
    setNameResult(fields.map((f) => f.trim()).join("_"));
  };

  const copyNameResult = async () => {
    if (!nameResult) return;
    try {
      await navigator.clipboard.writeText(nameResult);
    } catch {
      // no-op
    }
  };

  return (
    <DashboardSection
      title="Name Convention"
      icon={<ClipboardList className="h-3.5 w-3.5 text-orange-500" />}
      className="border-orange-100 bg-gradient-to-br from-white via-orange-50/35 to-amber-50/25"
      contentClassName="space-y-3"
      headerClassName="px-3 py-2.5"
      titleClassName="text-[11px] tracking-[0.18em]"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-slate-600">
          Generate standardized ad and campaign names without leaving the
          dashboard.
        </p>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-sm font-medium text-slate-700">
          <button
            className={`rounded-md px-3 py-1 ${
              nameTab === "ads"
                ? "bg-white text-orange-700 shadow-sm ring-1 ring-orange-100"
                : "text-slate-500"
            }`}
            onClick={() => setNameTab("ads")}
          >
            Ads
          </button>
          <button
            className={`rounded-md px-3 py-1 ${
              nameTab === "campaign"
                ? "bg-white text-orange-700 shadow-sm ring-1 ring-orange-100"
                : "text-slate-500"
            }`}
            onClick={() => setNameTab("campaign")}
          >
            Campaign
          </button>
        </div>
      </div>
      {nameTab === "ads" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-700">
              <span>Collection / Product Name</span>
              <input
                type="text"
                value={adsInputs.f1}
                onChange={(e) =>
                  setAdsInputs((prev) => ({ ...prev, f1: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Summary</span>
              <input
                type="text"
                value={adsInputs.f2}
                onChange={(e) =>
                  setAdsInputs((prev) => ({ ...prev, f2: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Team Code</span>
              <input
                type="text"
                value={teamCodeLoading ? "Loading..." : teamCode}
                readOnly
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Marketing Associate (employeeId)</span>
              <input
                type="text"
                value={employeeId || ""}
                readOnly
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              />
            </label>
            <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
              <span>Date Version</span>
              <input
                type="text"
                value={adsInputs.f5}
                onChange={(e) =>
                  setAdsInputs((prev) => ({ ...prev, f5: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </label>
          </div>
          {nameError ? (
            <p className="text-sm text-red-600">{nameError}</p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button onClick={generateName}>Generate</Button>
            {nameResult ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-sm text-slate-700">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Result
                </span>
                <span className="break-all font-semibold text-slate-900">
                  {nameResult}
                </span>
                <button
                  type="button"
                  onClick={copyNameResult}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-orange-200 hover:text-orange-700"
                  title="Copy"
                >
                  Copy
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-700">
              <span>Type</span>
              <select
                value={campaignInputs.type}
                onChange={(e) =>
                  setCampaignInputs((prev) => ({
                    ...prev,
                    type: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              >
                <option value="">Select type</option>
                <option value="Testing">Testing</option>
                <option value="Scaling">Scaling</option>
                <option value="Repost Low Spent">Repost Low Spent</option>
                <option value="Repost Winning">Repost Winning</option>
              </select>
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Employee ID</span>
              <input
                type="text"
                value={campaignInputs.emp || employeeId || ""}
                onChange={(e) =>
                  setCampaignInputs((prev) => ({
                    ...prev,
                    emp: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Shop Name</span>
              <input
                type="text"
                value={campaignInputs.shop}
                onChange={(e) =>
                  setCampaignInputs((prev) => ({
                    ...prev,
                    shop: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Collection / Product Name</span>
              <input
                type="text"
                value={campaignInputs.product}
                onChange={(e) =>
                  setCampaignInputs((prev) => ({
                    ...prev,
                    product: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Mapping Code</span>
              <input
                type="text"
                value={campaignInputs.mapping}
                onChange={(e) =>
                  setCampaignInputs((prev) => ({
                    ...prev,
                    mapping: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Date</span>
              <input
                type="text"
                value={campaignInputs.date}
                onChange={(e) =>
                  setCampaignInputs((prev) => ({
                    ...prev,
                    date: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </label>
          </div>
          {nameError ? (
            <p className="text-sm text-red-600">{nameError}</p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button onClick={generateName}>Generate</Button>
            {nameResult ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-sm text-slate-700">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Result
                </span>
                <span className="break-all font-semibold text-slate-900">
                  {nameResult}
                </span>
                <button
                  type="button"
                  onClick={copyNameResult}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-orange-200 hover:text-orange-700"
                  title="Copy"
                >
                  Copy
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </DashboardSection>
  );
}

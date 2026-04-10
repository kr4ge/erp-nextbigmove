"use client";

import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { DashboardSection } from "./dashboard-section";

interface NameConventionCardProps {
  teamCode: string;
  teamCodeLoading: boolean;
  employeeId?: string | null;
}

const namingLabelClass = "space-y-2 text-sm";
const namingLabelTextClass =
  "text-xs font-semibold uppercase tracking-[0.16em] text-slate-500";
const namingInputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100";
const namingReadOnlyInputClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none";
const namingSoftButtonClass =
  "inline-flex items-center justify-center rounded-2xl border border-orange-200 bg-orange-50 px-5 py-3 text-center text-sm font-semibold text-orange-700 shadow-sm transition-colors hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50";
const namingSoftActionButtonClass =
  "inline-flex items-center justify-center rounded-2xl border border-orange-200 bg-orange-50 px-3 py-1.5 text-center text-xs font-semibold text-orange-700 shadow-sm transition-colors hover:bg-orange-100";

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
        <div className="inline-flex self-start rounded-lg border border-slate-200 bg-slate-50 p-1 text-sm font-medium text-slate-700">
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
            <label className={namingLabelClass}>
              <span className={namingLabelTextClass}>Collection / Product Name</span>
              <input
                type="text"
                value={adsInputs.f1}
                onChange={(e) =>
                  setAdsInputs((prev) => ({ ...prev, f1: e.target.value }))
                }
                placeholder="e.g. Summer Glow Kit"
                className={namingInputClass}
              />
            </label>
            <label className={namingLabelClass}>
              <span className={namingLabelTextClass}>Summary</span>
              <input
                type="text"
                value={adsInputs.f2}
                onChange={(e) =>
                  setAdsInputs((prev) => ({ ...prev, f2: e.target.value }))
                }
                placeholder="e.g. UGC Hook v2"
                className={namingInputClass}
              />
            </label>
            <label className={namingLabelClass}>
              <span className={namingLabelTextClass}>Team Code</span>
              <input
                type="text"
                value={teamCodeLoading ? "Loading..." : teamCode}
                readOnly
                className={namingReadOnlyInputClass}
              />
            </label>
            <label className={namingLabelClass}>
              <span className={namingLabelTextClass}>Marketing Associate (employeeId)</span>
              <input
                type="text"
                value={employeeId || ""}
                readOnly
                className={namingReadOnlyInputClass}
              />
            </label>
            <label className={`${namingLabelClass} sm:col-span-2`}>
              <span className={namingLabelTextClass}>Date Version</span>
              <input
                type="text"
                value={adsInputs.f5}
                onChange={(e) =>
                  setAdsInputs((prev) => ({ ...prev, f5: e.target.value }))
                }
                placeholder="e.g. 041026-v1"
                className={namingInputClass}
              />
            </label>
          </div>
          {nameError ? (
            <p className="text-sm text-red-600">{nameError}</p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={generateName}
              className={namingSoftButtonClass}
            >
              Generate
            </button>
            {nameResult ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-700">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Result
                </span>
                <span className="break-all font-semibold text-slate-900">
                  {nameResult}
                </span>
                <button
                  type="button"
                  onClick={copyNameResult}
                  className={namingSoftActionButtonClass}
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
            <label className={namingLabelClass}>
              <span className={namingLabelTextClass}>Type</span>
              <select
                value={campaignInputs.type}
                onChange={(e) =>
                  setCampaignInputs((prev) => ({
                    ...prev,
                    type: e.target.value,
                  }))
                }
                className={namingInputClass}
              >
                <option value="">Select type</option>
                <option value="Testing">Testing</option>
                <option value="Scaling">Scaling</option>
                <option value="Repost Low Spent">Repost Low Spent</option>
                <option value="Repost Winning">Repost Winning</option>
              </select>
            </label>
            <label className={namingLabelClass}>
              <span className={namingLabelTextClass}>Employee ID</span>
              <input
                type="text"
                value={campaignInputs.emp || employeeId || ""}
                onChange={(e) =>
                  setCampaignInputs((prev) => ({
                    ...prev,
                    emp: e.target.value,
                  }))
                }
                placeholder="e.g. EMP-102"
                className={namingInputClass}
              />
            </label>
            <label className={namingLabelClass}>
              <span className={namingLabelTextClass}>Shop Name</span>
              <input
                type="text"
                value={campaignInputs.shop}
                onChange={(e) =>
                  setCampaignInputs((prev) => ({
                    ...prev,
                    shop: e.target.value,
                  }))
                }
                placeholder="e.g. TikTok Main"
                className={namingInputClass}
              />
            </label>
            <label className={namingLabelClass}>
              <span className={namingLabelTextClass}>Collection / Product Name</span>
              <input
                type="text"
                value={campaignInputs.product}
                onChange={(e) =>
                  setCampaignInputs((prev) => ({
                    ...prev,
                    product: e.target.value,
                  }))
                }
                placeholder="e.g. Glow Serum"
                className={namingInputClass}
              />
            </label>
            <label className={namingLabelClass}>
              <span className={namingLabelTextClass}>Mapping Code</span>
              <input
                type="text"
                value={campaignInputs.mapping}
                onChange={(e) =>
                  setCampaignInputs((prev) => ({
                    ...prev,
                    mapping: e.target.value,
                  }))
                }
                placeholder="e.g. M08"
                className={namingInputClass}
              />
            </label>
            <label className={namingLabelClass}>
              <span className={namingLabelTextClass}>Date</span>
              <input
                type="text"
                value={campaignInputs.date}
                onChange={(e) =>
                  setCampaignInputs((prev) => ({
                    ...prev,
                    date: e.target.value,
                  }))
                }
                placeholder="e.g. 041026"
                className={namingInputClass}
              />
            </label>
          </div>
          {nameError ? (
            <p className="text-sm text-red-600">{nameError}</p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={generateName}
              className={namingSoftButtonClass}
            >
              Generate
            </button>
            {nameResult ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-700">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Result
                </span>
                <span className="break-all font-semibold text-slate-900">
                  {nameResult}
                </span>
                <button
                  type="button"
                  onClick={copyNameResult}
                  className={namingSoftActionButtonClass}
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

"use client";

import { useState } from "react";
import {
  Check,
  Coins,
  Globe,
  Info,
  Lock,
  Mail,
  FileSpreadsheet,
  FileText,
  Monitor,
  CalendarDays,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/settings/PageHeader";
import { ToastViewport, useToast } from "@/components/settings/Toast";
import { updateLocalizationAction } from "@/app/actions/settings";

type Locale = "en" | "fr";
type HourCycle = "24" | "12";
type DateFormat = "eu" | "us";

const SAMPLE_AMOUNT = 1234560.5;

/** Fixed reference instant — stable across prerender and hydration. */
const SAMPLE_DATE = new Date(2026, 10, 13, 14, 30);

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function LocalizationView({
  initial = null,
  live = false,
}: {
  initial?: { defaultLocale: Locale; hourCycle: HourCycle; dateFormat: DateFormat } | null;
  live?: boolean;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const { toasts, push } = useToast();
  const [locale, setLocale] = useState<Locale>(initial?.defaultLocale ?? "en");
  const [hourCycle, setHourCycle] = useState<HourCycle>(initial?.hourCycle ?? "24");
  const [dateFormat, setDateFormat] = useState<DateFormat>(initial?.dateFormat ?? "eu");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!live) {
      push(t("localizationSavedDemo"));
      return;
    }
    setSaving(true);
    const res = await updateLocalizationAction({ defaultLocale: locale, hourCycle, dateFormat });
    setSaving(false);
    if (!res.ok) {
      push(res.error.message);
      return;
    }
    push(t("localizationSaved"));
    router.refresh();
  };

  const now = SAMPLE_DATE;
  const dd = pad2(now.getDate());
  const mm = pad2(now.getMonth() + 1);
  const yyyy = String(now.getFullYear());
  const sampleEu = `${dd}/${mm}/${yyyy}`;
  const sampleUs = `${mm}/${dd}/${yyyy}`;

  const timeSample = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: hourCycle === "12",
  }).format(now);

  const madEn = new Intl.NumberFormat("en-MA", { style: "currency", currency: "MAD" }).format(SAMPLE_AMOUNT);
  const madFr = new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(SAMPLE_AMOUNT);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t("tabLocalization")}
        sub={t("localizationSub")}
      />

      <div className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="card divide-y divide-divider p-5 sm:p-6">
          {/* Locale */}
          <div className="grid gap-3 py-4 first:pt-0 sm:grid-cols-[210px_1fr] sm:gap-6">
            <div>
              <h2 className="text-[13px] font-extrabold text-obsidian">{t("defaultLocaleHeading")}</h2>
              <p className="mt-1 text-[11px] font-medium leading-snug text-muted">{t("defaultLocaleDesc")}</p>
            </div>
            <div>
              <div role="group" aria-label={t("defaultLocaleHeading")} className="segmented">
                {(["en", "fr"] as const).map((l) => (
                  <button key={l} type="button" aria-pressed={locale === l} onClick={() => setLocale(l)} className={`segment ${locale === l ? "segment-active" : ""}`}>
                    {l === "en" ? "EN" : "FR"}
                  </button>
                ))}
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-muted">
                <Info size={12} strokeWidth={2.2} aria-hidden="true" />
                {t("profileOverrideNote")}
              </p>
            </div>
          </div>

          {/* Hour cycle */}
          <div className="grid gap-3 py-4 sm:grid-cols-[210px_1fr] sm:gap-6">
            <div>
              <h2 className="text-[13px] font-extrabold text-obsidian">{t("hourCycleHeading")}</h2>
              <p className="mt-1 text-[11px] font-medium leading-snug text-muted">{t("hourCycleDesc")}</p>
            </div>
            <div>
              <div role="group" aria-label={t("hourCycleHeading")} className="segmented">
                <button type="button" aria-pressed={hourCycle === "24"} onClick={() => setHourCycle("24")} className={`segment ${hourCycle === "24" ? "segment-active" : ""}`}>24 h</button>
                <button type="button" aria-pressed={hourCycle === "12"} onClick={() => setHourCycle("12")} className={`segment ${hourCycle === "12" ? "segment-active" : ""}`}>12 h</button>
              </div>
              <p className="mt-2 font-mono text-[12px] font-semibold text-obsidian">
                {t("samplePrefix")}{" "}
                <span className="rounded-sm bg-canvas px-1.5 py-0.5">{timeSample}</span>
              </p>
            </div>
          </div>

          {/* Date format */}
          <div className="grid gap-3 py-4 sm:grid-cols-[210px_1fr] sm:gap-6">
            <div>
              <h2 className="text-[13px] font-extrabold text-obsidian">{t("dateFormatHeading")}</h2>
              <p className="mt-1 text-[11px] font-medium leading-snug text-muted">{t("dateFormatDesc")}</p>
            </div>
            <div>
              <div role="group" aria-label={t("dateFormatHeading")} className="segmented">
                <button type="button" aria-pressed={dateFormat === "eu"} onClick={() => setDateFormat("eu")} className={`segment ${dateFormat === "eu" ? "segment-active" : ""}`}>JJ/MM/AAAA</button>
                <button type="button" aria-pressed={dateFormat === "us"} onClick={() => setDateFormat("us")} className={`segment ${dateFormat === "us" ? "segment-active" : ""}`}>MM/DD/YYYY</button>
              </div>
              <ul className="mt-2 space-y-1">
                {([
                  { key: "eu" as const, label: "JJ/MM/AAAA", sample: sampleEu },
                  { key: "us" as const, label: "MM/DD/YYYY", sample: sampleUs },
                ]).map(({ key, label, sample }) => {
                  const selected = dateFormat === key;
                  return (
                    <li key={key} className={`flex items-center gap-2 text-[11px] font-medium ${selected ? "text-obsidian" : "text-muted"}`}>
                      {selected ? <Check size={12} strokeWidth={2.6} aria-hidden="true" className="text-electric" /> : <span className="w-3" aria-hidden="true" />}
                      <span className="w-20">{label}</span>
                      <span className="rounded-sm bg-canvas px-1.5 py-0.5 font-mono text-[11px]">{sample}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* Week start */}
          <div className="grid gap-3 py-4 sm:grid-cols-[210px_1fr] sm:gap-6">
            <div>
              <h2 className="text-[13px] font-extrabold text-obsidian">{t("weekStartLabel")}</h2>
              <p className="mt-1 text-[11px] font-medium leading-snug text-muted">{t("weekStartDesc")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input className="input h-11 w-36 cursor-not-allowed bg-canvas text-muted" value={t("dayMonday")} disabled aria-label={t("weekStartFixedAria")} />
              <span className="chip border border-border bg-canvas text-muted">
                <Lock size={11} strokeWidth={2.4} aria-hidden="true" />
                {t("businessStandard")}
              </span>
            </div>
          </div>

          {/* Currency rendering */}
          <div className="grid gap-3 py-4 last:pb-0 sm:grid-cols-[210px_1fr] sm:gap-6">
            <div>
              <h2 className="text-[13px] font-extrabold text-obsidian">{t("amountsMadHeading")}</h2>
              <p className="mt-1 text-[11px] font-medium leading-snug text-muted">{t("amountsMadDesc")}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { key: "en", tag: "en-MA", label: t("localeEnName"), value: madEn },
                { key: "fr", tag: "fr-MA", label: t("localeFrName"), value: madFr },
              ].map(({ key, tag, label, value }) => {
                const selected = locale === key;
                return (
                  <div
                    key={key}
                    className={`rounded-sm border p-3 transition-shadow ${
                      selected ? "border-electric/50 bg-electric-tint/40 ring-2 ring-electric/30" : "border-border bg-canvas/60"
                    }`}
                    aria-current={selected ? "true" : undefined}
                  >
                    <p className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
                      {label} · <span className="font-mono normal-case">{tag}</span>
                      {selected ? <Check size={12} strokeWidth={2.6} aria-hidden="true" className="text-electric" /> : null}
                    </p>
                    <p className="mt-1.5 truncate font-mono text-[15px] font-bold text-obsidian" title={value}>{value}</p>
                    <p className="mt-0.5 text-[10px] font-medium text-muted">{t("liveSampleNote")}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end pt-4">
            <button type="button" onClick={() => void save()} disabled={saving} className="btn btn-primary h-11 disabled:opacity-60">
              {saving ? t("saving") : t("saveChanges")}
            </button>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">
              <Globe size={14} strokeWidth={2.2} aria-hidden="true" />
              {t("localizedSurfacesHeading")}
            </h2>
            <ul className="mt-3 space-y-2.5 text-[12px] font-medium leading-snug text-obsidian-light">
              <li className="flex gap-2"><FileText size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />{t("surfaceInvoices")}</li>
              <li className="flex gap-2"><Mail size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />{t("surfaceEmails")}</li>
              <li className="flex gap-2"><FileSpreadsheet size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />{t("surfaceCsv")}</li>
              <li className="flex gap-2"><Monitor size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />{t("surfacePublicSiteBefore")} <code className="rounded-sm bg-canvas px-1 font-mono text-[10px]">lang</code> {t("surfacePublicSiteAfter")}</li>
            </ul>
          </div>
          <div className="card p-5">
            <h2 className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">
              <CalendarDays size={14} strokeWidth={2.2} aria-hidden="true" />
              {t("moroccoDefaultHeading")}
            </h2>
            <p className="mt-2 text-[12px] font-medium leading-snug text-obsidian-light">
              {t("moroccoDefaultNote")}
            </p>
          </div>
          <div className="flex items-start gap-2 rounded-sm bg-tint-blue p-3 text-[11px] font-medium leading-snug text-tint-fg-blue">
            <Coins size={13} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 shrink-0" />
            {t("currencyDisplayNote")}
          </div>
        </aside>
      </div>

      <ToastViewport toasts={toasts} />
    </div>
  );
}

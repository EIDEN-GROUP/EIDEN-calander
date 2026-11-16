"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CircleExclamationPoint,
  Info,
  Mail,
  Phone,
  ImagePlus,
  X,
  ScrollText,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/settings/PageHeader";
import { ToastViewport, useToast } from "@/components/settings/Toast";
import { NowBarMark } from "@/components/brand/NowBar";
import { createClient } from "@/lib/supabase/client";
import { updateBusinessProfileAction, updateBusinessLogoAction } from "@/app/actions/settings";
import { sanitizeSvg } from "@/lib/svg-sanitize";

export interface GeneralInitial {
  businessName: string;
  legalName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  timezone: string;
  currency: string;
  publicUrl: string;
  logoUrl: string | null;
  defaultLocale: Locale;
  slotIncrementMin: 15 | 30 | 60;
  bufferMin: number;
  minNoticeHours: number;
}

type Locale = "en" | "fr";

const TIMEZONES = [
  { value: "Africa/Casablanca", label: "Africa/Casablanca" },
  { value: "Europe/Paris", label: "Europe/Paris" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Africa/Dakar", label: "Africa/Dakar" },
  { value: "UTC", label: "UTC" },
];

const CURRENCIES = [
  { value: "MAD", labelKey: "currencyMad" },
  { value: "EUR", labelKey: "currencyEur" },
  { value: "USD", labelKey: "currencyUsd" },
] as const;

const COUNTRIES = [
  { value: "Morocco", labelKey: "countryMorocco" },
  { value: "France", labelKey: "countryFrance" },
  { value: "Belgium", labelKey: "countryBelgium" },
  { value: "Spain", labelKey: "countrySpain" },
  { value: "United Arab Emirates", labelKey: "countryUae" },
] as const;

const ALLOWED_LOGO_TYPES = ["image/svg+xml", "image/png", "image/webp"];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export function GeneralView({ initial = null, live = false }: { initial?: GeneralInitial | null; live?: boolean }) {
  const t = useTranslations("settings");
  const router = useRouter();
  const { toasts, leaving, push } = useToast();

  const [businessName, setBusinessName] = useState(initial?.businessName ?? "Eiden Group");
  const [legalName, setLegalName] = useState(initial?.legalName ?? "Eiden Group SARL");
  const [contactEmail, setContactEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [country, setCountry] = useState(initial?.country ?? "Morocco");
  const [timezone, setTimezone] = useState(initial?.timezone ?? "Africa/Casablanca");
  const [currency, setCurrency] = useState(initial?.currency ?? "MAD");
  const [locale, setLocale] = useState<Locale>(initial?.defaultLocale ?? "en");
  const [siteUrl, setSiteUrl] = useState(initial?.publicUrl ?? "https://eiden-group.com");

  const [logo, setLogo] = useState<{ name: string; url: string } | null>(
    initial?.logoUrl ? { name: t("currentLogo"), url: initial.logoUrl } : null,
  );
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoUrlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
    },
    [],
  );

  const handleLogoFile = async (file: File) => {
    if (logoError) setLogoError(null);
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setLogoError(t("logoUnsupportedType"));
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError(t("logoTooLarge"));
      return;
    }
    if (!live) {
      const url = URL.createObjectURL(file);
      if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
      logoUrlRef.current = url;
      setLogo({ name: file.name, url });
      return;
    }
    // Live: sanitize SVG (defense in depth — executable content stripped),
    // then upload to the public brand-assets bucket (admin-only write) and
    // point business_settings.logo_url at the public URL.
    setLogoBusy(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error(t("supabaseNotConfigured"));
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "svg";
      let payload: Blob = file;
      if (ext === "svg" || file.type === "image/svg+xml") {
        const text = await file.text();
        const clean = sanitizeSvg(text);
        if (!clean) throw new Error(t("logoUnsupportedType"));
        payload = new Blob([clean], { type: "image/svg+xml" });
      }
      const path = `logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("brand-assets").upload(path, payload, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("brand-assets").getPublicUrl(path);
      const res = await updateBusinessLogoAction({ logoUrl: pub.publicUrl });
      if (!res.ok) throw new Error(res.error.message);
      setLogo({ name: file.name, url: pub.publicUrl });
      push(t("logoUpdated"));
      router.refresh();
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : t("logoUploadFailed"));
    } finally {
      setLogoBusy(false);
    }
  };

  const onLogoPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void handleLogoFile(file);
  };

  const removeLogo = async () => {
    if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
    logoUrlRef.current = null;
    setLogo(null);
    setLogoError(null);
    if (live) {
      const res = await updateBusinessLogoAction({ logoUrl: null });
      if (res.ok) push(t("logoRemoved"));
      else push(res.error.message);
      router.refresh();
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!live) {
      push(t("savedDemo"));
      return;
    }
    setSaving(true);
    const res = await updateBusinessProfileAction({
      businessName: businessName.trim(),
      legalName: legalName.trim() || null,
      email: contactEmail.trim(),
      phone: phone.trim() || null,
      address: address.trim() || null,
      city: city.trim() || null,
      country,
      timezone,
      currency,
      publicUrl: siteUrl.trim() || null,
      slotIncrementMin: initial?.slotIncrementMin ?? 30,
      bufferMin: initial?.bufferMin ?? 0,
      minNoticeHours: initial?.minNoticeHours ?? 2,
      defaultLocale: locale,
    });
    setSaving(false);
    if (!res.ok) {
      push(res.error.message);
      return;
    }
    push(t("generalSaved"));
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t("tabGeneral")}
        sub={t("generalSub")}
      />

      <div className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <form onSubmit={onSubmit} className="card space-y-6 p-5 sm:p-6">
          <div className="flex items-center gap-2.5 border-b border-divider pb-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-tint-blue text-electric">
              <Building2 size={18} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-[15px] font-extrabold text-obsidian">{t("businessProfileTitle")}</h2>
              <p className="text-[11px] font-medium text-muted">{t("businessProfileDesc")}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="gen-business-name" className="label">{t("businessNameLabel")}</label>
              <input id="gen-business-name" className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} autoComplete="organization" />
            </div>
            <div>
              <label htmlFor="gen-legal-name" className="label">{t("legalNameLabel")}</label>
              <input id="gen-legal-name" className="input" value={legalName} onChange={(e) => setLegalName(e.target.value)} autoComplete="organization" />
            </div>
            <div>
              <label htmlFor="gen-contact-email" className="label">{t("contactEmailLabel")}</label>
              <input id="gen-contact-email" type="email" className="input font-mono text-[13px]" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} autoComplete="email" />
            </div>
            <div>
              <label htmlFor="gen-phone" className="label">{t("phoneLabel")}</label>
              <input id="gen-phone" type="tel" className="input font-mono text-[13px]" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="gen-address" className="label">{t("addressLabel")}</label>
              <input id="gen-address" className="input" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" />
            </div>
            <div>
              <label htmlFor="gen-city" className="label">{t("cityLabel")}</label>
              <input id="gen-city" className="input" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" />
            </div>
            <div>
              <label htmlFor="gen-country" className="label">{t("countryLabel")}</label>
              <select id="gen-country" className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
                {COUNTRIES.map((c) => (
                  <option key={c.value} value={c.value}>{t(c.labelKey)}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="gen-timezone" className="label">{t("timezoneLabel")}</label>
              <select id="gen-timezone" className="input font-mono text-[13px]" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] font-medium leading-snug text-muted">{t("timezoneNote")}</p>
            </div>
            <div>
              <label htmlFor="gen-currency" className="label">{t("currencyLabel")}</label>
              <select id="gen-currency" className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>{t(c.labelKey)}</option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] font-medium leading-snug text-muted">{t("currencyNote")}</p>
            </div>
            <div className="sm:col-span-2">
              <span className="label" id="gen-locale-label">{t("defaultLocaleLabel")}</span>
              <div role="group" aria-labelledby="gen-locale-label" className="segmented">
                {(["en", "fr"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    aria-pressed={locale === l}
                    onClick={() => setLocale(l)}
                    className={`segment ${locale === l ? "segment-active" : ""}`}
                  >
                    {l === "en" ? t("localeEnOption") : t("localeFrOption")}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] font-medium leading-snug text-muted">{t("localeNote")}</p>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="gen-site-url" className="label">{t("siteUrlLabel")}</label>
              <input id="gen-site-url" type="url" inputMode="url" className="input font-mono text-[13px]" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://" />
            </div>
          </div>

          <div>
            <span className="label" id="gen-logo-label">{t("logoLabel")}</span>
            <div
              role="group"
              aria-labelledby="gen-logo-label"
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void handleLogoFile(file);
              }}
              className={`flex flex-col items-center justify-center rounded-md border border-dashed px-6 py-6 text-center transition-colors ${
                dragging ? "border-electric/60 bg-electric-tint/40" : "border-black/15 bg-canvas/60"
              }`}
            >
              <input
                ref={logoInputRef}
                type="file"
                accept=".svg,.png,.webp,image/svg+xml,image/png,image/webp"
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
                onChange={onLogoPick}
              />
              {logoBusy ? (
                <p className="text-[13px] font-semibold text-obsidian-light" role="status">{t("logoUploading")}</p>
              ) : logo ? (
                <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-between">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- client-side object URL preview */}
                    <img
                      src={logo.url}
                      alt={t("logoPreviewAlt", { name: logo.name })}
                      className="h-16 w-16 rounded-sm border border-border bg-white object-contain p-1.5"
                    />
                    <div className="text-left">
                      <p title={logo.name} className="max-w-[220px] truncate font-mono text-[12px] font-semibold text-obsidian">{logo.name}</p>
                      <p className="mt-0.5 text-[11px] font-medium text-muted">{live ? t("logoLiveNote") : t("logoDemoNote")}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-border bg-white px-3 text-[12px] font-semibold text-obsidian-light transition-colors hover:bg-canvas"
                  >
                    <X size={13} strokeWidth={2.4} aria-hidden="true" />
                    {t("removeLogoButton")}
                  </button>
                </div>
              ) : (
                <>
                  <span className="flex h-11 w-11 items-center justify-center rounded-pill bg-white text-muted shadow-sm">
                    <ImagePlus size={20} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <p className="mt-2.5 text-[13px] font-semibold text-obsidian">{t("logoDragDrop")}</p>
                  <button type="button" onClick={() => logoInputRef.current?.click()} className="btn btn-secondary mt-2 h-9 px-4 text-[13px]">
                    {t("logoBrowse")}
                  </button>
                </>
              )}
            </div>
            <p className="mt-1.5 text-[11px] font-medium leading-snug text-muted">{t("logoFormatsBefore")} <code>&lt;img&gt;</code> {t("logoFormatsAfter")}</p>
            {logoError ? (
              <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-error-fg">
                <CircleExclamationPoint size={13} strokeWidth={2.2} aria-hidden="true" />
                {logoError}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
              <ScrollText size={12} strokeWidth={2} aria-hidden="true" />
              {t("auditLogNote")}
            </p>
            <button type="submit" disabled={saving} className="btn btn-primary h-11 disabled:opacity-60">
              {saving ? t("saving") : t("saveChanges")}
            </button>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <NowBarMark size={44} />
              <div>
                <p className="text-[17px] font-extrabold leading-none tracking-[-0.02em] text-obsidian">
                  CALENDAR<span className="text-electric">.</span>
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">by Eiden Group</p>
              </div>
            </div>
            <p className="mt-3 text-[13px] font-semibold leading-snug text-obsidian-light">Architecture for Time.</p>

            <dl className="mt-4 divide-y divide-divider border-y border-divider">
              {[
                { term: t("previewTimezone"), value: timezone },
                { term: t("previewCurrency"), value: currency },
                { term: t("previewWeekStart"), value: t("mondayLabel") },
                { term: t("previewLocale"), value: locale === "en" ? t("localeSummaryEn") : t("localeSummaryFr") },
              ].map(({ term, value }) => (
                <div key={term} className="grid grid-cols-[104px_1fr] items-baseline gap-3 py-2.5">
                  <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{term}</dt>
                  <dd title={value} className="min-w-0 truncate font-mono text-[12px] font-semibold text-obsidian">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 flex items-start gap-2 rounded-sm bg-tint-blue p-3 text-[12px] font-medium leading-snug text-tint-fg-blue">
              <Info size={14} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 shrink-0" />
              {t("logoFaviconNote")}
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-sm border border-divider bg-canvas/60 px-3 py-2.5 text-[11px] font-medium leading-snug text-muted">
              <Mail size={13} strokeWidth={2} aria-hidden="true" className="shrink-0" />
              <span>{t("publicIdentityOn")} <span className="font-mono text-obsidian-light">{siteUrl.replace(/^https?:\/\//, "") || "eiden-group.com"}</span></span>
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-sm border border-divider bg-canvas/60 px-3 py-2.5 text-[11px] font-medium leading-snug text-muted">
              <Phone size={13} strokeWidth={2} aria-hidden="true" className="shrink-0" />
              <span>{t("repliesRouteTo")} <span className="font-mono text-obsidian-light">{contactEmail}</span></span>
            </div>
          </div>
        </aside>
      </div>

      <ToastViewport toasts={toasts} leaving={leaving} />
    </div>
  );
}

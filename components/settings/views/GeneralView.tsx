"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
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
import { PageHeader } from "@/components/settings/PageHeader";
import { ToastViewport, useToast } from "@/components/settings/Toast";
import { NowBarMark } from "@/components/brand/NowBar";

type Locale = "en" | "fr";

const TIMEZONES = [
  { value: "Africa/Casablanca", label: "Africa/Casablanca" },
  { value: "Europe/Paris", label: "Europe/Paris" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Africa/Dakar", label: "Africa/Dakar" },
  { value: "UTC", label: "UTC" },
];

const CURRENCIES = [
  { value: "MAD", label: "MAD — Moroccan Dirham" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "USD", label: "USD — US Dollar" },
];

const COUNTRIES = ["Morocco", "France", "Belgium", "Spain", "United Arab Emirates"];

const ALLOWED_LOGO_TYPES = ["image/svg+xml", "image/png", "image/webp"];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export function GeneralView() {
  const { toasts, push } = useToast();

  const [businessName, setBusinessName] = useState("Eiden Group");
  const [legalName, setLegalName] = useState("Eiden Group SARL");
  const [contactEmail, setContactEmail] = useState("contact@eiden-group.com");
  const [phone, setPhone] = useState("+212 5 22 00 00 00");
  const [address, setAddress] = useState("Immeuble Al Blanca, Boulevard d'Anfa, 8ème étage");
  const [city, setCity] = useState("Casablanca");
  const [country, setCountry] = useState("Morocco");
  const [timezone, setTimezone] = useState("Africa/Casablanca");
  const [currency, setCurrency] = useState("MAD");
  const [locale, setLocale] = useState<Locale>("en");
  const [siteUrl, setSiteUrl] = useState("https://eiden-group.com");

  const [logo, setLogo] = useState<{ name: string; url: string } | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoUrlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
    },
    [],
  );

  const handleLogoFile = (file: File) => {
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
      logoUrlRef.current = null;
      setLogo(null);
      setLogoError("Unsupported file — use SVG, PNG or WebP.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
      logoUrlRef.current = null;
      setLogo(null);
      setLogoError("File is larger than 2MB — export a smaller version and try again.");
      return;
    }
    const url = URL.createObjectURL(file);
    if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
    logoUrlRef.current = url;
    setLogo({ name: file.name, url });
    setLogoError(null);
  };

  const onLogoPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) handleLogoFile(file);
  };

  const removeLogo = () => {
    if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
    logoUrlRef.current = null;
    setLogo(null);
    setLogoError(null);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    push("Saved (demo)");
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="General"
        sub="Business identity, contact details, timezone and currency — the single source of truth for invoices, emails and the public site."
      />

      <div className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <form onSubmit={onSubmit} className="card space-y-6 p-5 sm:p-6">
          <div className="flex items-center gap-2.5 border-b border-divider pb-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-tint-blue text-electric">
              <Building2 size={18} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-[15px] font-extrabold text-obsidian">Business profile</h2>
              <p className="text-[11px] font-medium text-muted">Shown on emails, invoices and the login screen.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="gen-business-name" className="label">Business name</label>
              <input id="gen-business-name" className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} autoComplete="organization" />
            </div>
            <div>
              <label htmlFor="gen-legal-name" className="label">Legal name</label>
              <input id="gen-legal-name" className="input" value={legalName} onChange={(e) => setLegalName(e.target.value)} autoComplete="organization" />
            </div>
            <div>
              <label htmlFor="gen-contact-email" className="label">Contact email</label>
              <input id="gen-contact-email" type="email" className="input font-mono text-[13px]" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} autoComplete="email" />
            </div>
            <div>
              <label htmlFor="gen-phone" className="label">Phone</label>
              <input id="gen-phone" type="tel" className="input font-mono text-[13px]" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="gen-address" className="label">Address</label>
              <input id="gen-address" className="input" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" />
            </div>
            <div>
              <label htmlFor="gen-city" className="label">City</label>
              <input id="gen-city" className="input" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" />
            </div>
            <div>
              <label htmlFor="gen-country" className="label">Country</label>
              <select id="gen-country" className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="gen-timezone" className="label">Timezone</label>
              <select id="gen-timezone" className="input font-mono text-[13px]" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] font-medium leading-snug text-muted">Covers Casablanca &amp; Agadir — same time</p>
            </div>
            <div>
              <label htmlFor="gen-currency" className="label">Currency</label>
              <select id="gen-currency" className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] font-medium leading-snug text-muted">Amounts on invoices and exports</p>
            </div>
            <div className="sm:col-span-2">
              <span className="label" id="gen-locale-label">Default locale</span>
              <div role="group" aria-labelledby="gen-locale-label" className="segmented">
                {(["en", "fr"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    aria-pressed={locale === l}
                    onClick={() => setLocale(l)}
                    className={`segment ${locale === l ? "segment-active" : ""}`}
                  >
                    {l === "en" ? "EN — English" : "FR — Français"}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] font-medium leading-snug text-muted">Users can override this per profile</p>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="gen-site-url" className="label">Public site URL</label>
              <input id="gen-site-url" type="url" inputMode="url" className="input font-mono text-[13px]" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://" />
            </div>
          </div>

          <div>
            <span className="label" id="gen-logo-label">Logo</span>
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
                if (file) handleLogoFile(file);
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
              {logo ? (
                <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-between">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- client-side object URL preview */}
                    <img
                      src={logo.url}
                      alt={`Logo preview of ${logo.name}`}
                      className="h-16 w-16 rounded-sm border border-border bg-white object-contain p-1.5"
                    />
                    <div className="text-left">
                      <p className="max-w-[220px] truncate font-mono text-[12px] font-semibold text-obsidian">{logo.name}</p>
                      <p className="mt-0.5 text-[11px] font-medium text-muted">Ready — will replace the current logo on save</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-border bg-white px-3 text-[12px] font-semibold text-obsidian-light transition-colors hover:bg-canvas"
                  >
                    <X size={13} strokeWidth={2.4} aria-hidden="true" />
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <span className="flex h-11 w-11 items-center justify-center rounded-pill bg-white text-muted shadow-sm">
                    <ImagePlus size={20} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <p className="mt-2.5 text-[13px] font-semibold text-obsidian">Drag &amp; drop your logo, or</p>
                  <button type="button" onClick={() => logoInputRef.current?.click()} className="btn btn-secondary mt-2 h-9 px-4 text-[13px]">
                    Browse files
                  </button>
                </>
              )}
            </div>
            <p className="mt-1.5 text-[11px] font-medium leading-snug text-muted">SVG, PNG or WebP · max 2MB (sanitized on upload)</p>
            {logoError ? (
              <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-error">
                <CircleExclamationPoint size={13} strokeWidth={2.2} aria-hidden="true" />
                {logoError}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
              <ScrollText size={12} strokeWidth={2} aria-hidden="true" />
              Changes are written to the audit log once live
            </p>
            <button type="submit" className="btn btn-primary h-11">Save changes</button>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <NowBarMark size={44} />
              <div>
                <p className="text-[17px] font-extrabold leading-none tracking-[-0.04em] text-obsidian">
                  CALENDAR<span className="text-electric">.</span>
                </p>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-muted">by Eiden Group</p>
              </div>
            </div>
            <p className="mt-3 text-[13px] font-semibold leading-snug text-obsidian-light">Architecture for Time.</p>

            <dl className="mt-4 divide-y divide-divider border-y border-divider">
              {[
                { term: "Timezone", value: timezone },
                { term: "Currency", value: currency },
                { term: "Week start", value: "Monday" },
                { term: "Locale", value: locale === "en" ? "English (EN)" : "Français (FR)" },
              ].map(({ term, value }) => (
                <div key={term} className="grid grid-cols-[104px_1fr] items-baseline gap-3 py-2.5">
                  <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{term}</dt>
                  <dd className="min-w-0 truncate font-mono text-[12px] font-semibold text-obsidian">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 flex items-start gap-2 rounded-sm bg-tint-blue p-3 text-[12px] font-medium leading-snug text-tint-fg-blue">
              <Info size={14} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 shrink-0" />
              Logo also updates favicon, login and emails once live.
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-sm border border-divider bg-canvas/60 px-3 py-2.5 text-[11px] font-medium leading-snug text-muted">
              <Mail size={13} strokeWidth={2} aria-hidden="true" className="shrink-0" />
              <span>Public identity on <span className="font-mono text-obsidian-light">{siteUrl.replace(/^https?:\/\//, "") || "eiden-group.com"}</span></span>
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-sm border border-divider bg-canvas/60 px-3 py-2.5 text-[11px] font-medium leading-snug text-muted">
              <Phone size={13} strokeWidth={2} aria-hidden="true" className="shrink-0" />
              <span>Replies route to <span className="font-mono text-obsidian-light">{contactEmail}</span></span>
            </div>
          </div>
        </aside>
      </div>

      <ToastViewport toasts={toasts} />
    </div>
  );
}

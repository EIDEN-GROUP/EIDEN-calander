"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  DoorOpen,
  GraduationCap,
  Lock,
  Pencil,
  Plus,
  Sparkles,
  Trash,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/settings/PageHeader";
import { ToastViewport, useToast } from "@/components/settings/Toast";
import { Modal } from "@/components/settings/Modal";
import { Switch } from "@/components/settings/Switch";
import { DEMO_CATEGORIES } from "@/lib/demo-data";

type TintColor = "blue" | "green" | "purple" | "amber" | "teal" | "rose";
type CategoryType = "standard" | "formation";
type IconKey = "calendar" | "door-open" | "graduation-cap" | "sparkles" | "users" | "wrench";

interface CategoryVM {
  id: string;
  name_en: string;
  name_fr: string;
  type: CategoryType;
  icon: IconKey;
  color: TintColor;
  is_system: boolean;
  is_active: boolean;
}

const TINT_ORDER: TintColor[] = ["blue", "green", "purple", "amber", "teal", "rose"];

const TINTS: Record<TintColor, { label: string; swatch: string; dot: string; chip: string }> = {
  blue: { label: "Blue", swatch: "bg-tint-blue", dot: "bg-tint-fg-blue", chip: "text-tint-fg-blue" },
  green: { label: "Green", swatch: "bg-tint-green", dot: "bg-tint-fg-green", chip: "text-tint-fg-green" },
  purple: { label: "Purple", swatch: "bg-tint-purple", dot: "bg-tint-fg-purple", chip: "text-tint-fg-purple" },
  amber: { label: "Amber", swatch: "bg-tint-amber", dot: "bg-tint-fg-amber", chip: "text-tint-fg-amber" },
  teal: { label: "Teal", swatch: "bg-tint-teal", dot: "bg-tint-fg-teal", chip: "text-tint-fg-teal" },
  rose: { label: "Rose", swatch: "bg-tint-rose", dot: "bg-tint-fg-rose", chip: "text-tint-fg-rose" },
};

const ICONS: Record<IconKey, LucideIcon> = {
  calendar: Calendar,
  "door-open": DoorOpen,
  "graduation-cap": GraduationCap,
  sparkles: Sparkles,
  users: Users,
  wrench: Wrench,
};

const ICON_LABELS: Record<IconKey, string> = {
  calendar: "Calendar",
  "door-open": "Door open",
  "graduation-cap": "Graduation cap",
  sparkles: "Sparkles",
  users: "Users",
  wrench: "Wrench",
};

const INITIAL_CATEGORIES: CategoryVM[] = [
  ...DEMO_CATEGORIES.map((c) => ({
    id: c.id,
    name_en: c.name_en,
    name_fr: c.name_fr ?? c.name_en,
    type: c.type,
    icon: (ICONS[c.icon as IconKey] ? c.icon : "calendar") as IconKey,
    color: (TINT_ORDER.includes(c.color as TintColor) ? c.color : "blue") as TintColor,
    is_system: c.is_system,
    is_active: c.is_active,
  })),
  { id: "cat-private-event", name_en: "Private Event", name_fr: "Événement privé", type: "standard", icon: "sparkles", color: "purple", is_system: false, is_active: true },
  { id: "cat-maintenance", name_en: "Maintenance", name_fr: "Maintenance", type: "standard", icon: "wrench", color: "amber", is_system: false, is_active: true },
];

export function CategoriesView() {
  const { toasts, push } = useToast();
  const [categories, setCategories] = useState<CategoryVM[]>(INITIAL_CATEGORIES);
  const [editing, setEditing] = useState<{ id: string; name_en: string; name_fr: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const [draftNameEn, setDraftNameEn] = useState("");
  const [draftNameFr, setDraftNameFr] = useState("");
  const [draftType, setDraftType] = useState<CategoryType>("standard");
  const [draftTint, setDraftTint] = useState<TintColor>("blue");
  const [draftIcon, setDraftIcon] = useState<IconKey>("calendar");
  const [draftError, setDraftError] = useState<string | null>(null);

  const activeCount = useMemo(() => categories.filter((c) => c.is_active).length, [categories]);

  const cycleColor = (id: string) => {
    const current = categories.find((c) => c.id === id);
    if (!current) return;
    const next = TINT_ORDER[(TINT_ORDER.indexOf(current.color) + 1) % TINT_ORDER.length];
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, color: next } : c)));
    push(`Color updated to ${TINTS[next].label} (demo)`);
  };

  const toggleActive = (id: string) => {
    const current = categories.find((c) => c.id === id);
    if (!current) return;
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: !c.is_active } : c)));
    push(`${current.name_en} ${current.is_active ? "deactivated" : "activated"} (demo)`);
  };

  const move = (id: string, direction: -1 | 1) => {
    const index = categories.findIndex((c) => c.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= categories.length) return;
    setCategories((prev) => {
      const from = prev.findIndex((c) => c.id === id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
    push("Category order updated (demo)");
  };

  const startRename = (c: CategoryVM) => {
    setConfirmDeleteId(null);
    setEditing({ id: c.id, name_en: c.name_en, name_fr: c.name_fr });
  };

  const commitRename = () => {
    if (!editing) return;
    const nameEn = editing.name_en.trim();
    if (!nameEn) return;
    setCategories((prev) =>
      prev.map((c) =>
        c.id === editing.id ? { ...c, name_en: nameEn, name_fr: editing.name_fr.trim() || nameEn } : c,
      ),
    );
    push("Category renamed (demo)");
    setEditing(null);
  };

  const deleteCategory = (id: string) => {
    const target = categories.find((c) => c.id === id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setConfirmDeleteId(null);
    if (target) push(`${target.name_en} deleted (demo)`);
  };

  const openAdd = () => {
    setDraftNameEn("");
    setDraftNameFr("");
    setDraftType("standard");
    setDraftTint("blue");
    setDraftIcon("calendar");
    setDraftError(null);
    setAddOpen(true);
  };

  const submitAdd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nameEn = draftNameEn.trim();
    if (!nameEn) {
      setDraftError("Give the category an English name first.");
      return;
    }
    const nameFr = draftNameFr.trim() || nameEn;
    setCategories((prev) => [
      ...prev,
      {
        id: `cat-${Date.now().toString(36)}`,
        name_en: nameEn,
        name_fr: nameFr,
        type: draftType,
        icon: draftIcon,
        color: draftTint,
        is_system: false,
        is_active: true,
      },
    ]);
    setAddOpen(false);
    push("Category added (demo)");
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Categories"
        sub="Booking categories shown across calendar, reports and filters. System entries can be renamed, never removed."
      >
        <button type="button" onClick={openAdd} className="btn btn-primary h-10 px-4 text-[13px]">
          <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
          Add category
        </button>
      </PageHeader>

      <div className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-divider px-4 py-3 sm:px-5">
            <p className="text-[12px] font-semibold text-obsidian-light">
              <span className="font-mono text-obsidian">{categories.length}</span> categories ·{" "}
              <span className="font-mono text-obsidian">{activeCount}</span> active
            </p>
            <p className="text-[11px] font-medium text-muted">Display order = order in booking pickers</p>
          </div>

          {categories.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <Calendar size={28} strokeWidth={1.6} aria-hidden="true" className="text-muted" />
              <p className="mt-3 text-[14px] font-bold text-obsidian">No categories yet</p>
              <p className="mt-1 max-w-sm text-[12px] font-medium text-muted">Add your first category — bookings, filters and reports will pick it up immediately.</p>
              <button type="button" onClick={openAdd} className="btn btn-primary mt-4 h-10 px-4 text-[13px]">
                <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
                Add category
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
                    <th scope="col" className="px-4 py-2.5">Color</th>
                    <th scope="col" className="px-3 py-2.5">Name (EN)</th>
                    <th scope="col" className="px-3 py-2.5">Name (FR)</th>
                    <th scope="col" className="px-3 py-2.5">Type</th>
                    <th scope="col" className="px-3 py-2.5">Icon</th>
                    <th scope="col" className="px-3 py-2.5">Active</th>
                    <th scope="col" className="px-3 py-2.5">Sort</th>
                    <th scope="col" className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {categories.map((category, index) => {
                    const isEditing = editing?.id === category.id;
                    const tint = TINTS[category.color];
                    const Icon = ICONS[category.icon];
                    return (
                      <tr key={category.id} className="align-middle transition-colors hover:bg-canvas/60">
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() => cycleColor(category.id)}
                            title={`Change color — currently ${tint.label}`}
                            aria-label={`Change color for ${category.name_en} — currently ${tint.label}`}
                            className={`flex h-8 w-8 items-center justify-center rounded-sm border border-border ${tint.swatch} transition-transform hover:scale-110`}
                          >
                            <span className={`h-3.5 w-3.5 rounded-pill ${tint.dot}`} aria-hidden="true" />
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          {isEditing ? (
                            <input
                              className="input h-9 w-40 px-3 text-[13px]"
                              value={editing.name_en}
                              autoFocus
                              aria-label="Name in English"
                              onChange={(e) => setEditing({ ...editing, name_en: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitRename();
                                if (e.key === "Escape") setEditing(null);
                              }}
                            />
                          ) : (
                            <span className="font-semibold text-obsidian">{category.name_en}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {isEditing ? (
                            <input
                              className="input h-9 w-40 px-3 text-[13px]"
                              value={editing.name_fr}
                              aria-label="Nom en français"
                              onChange={(e) => setEditing({ ...editing, name_fr: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitRename();
                                if (e.key === "Escape") setEditing(null);
                              }}
                            />
                          ) : (
                            <span className="text-obsidian-light">{category.name_fr}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`chip ${
                              category.type === "formation"
                                ? "bg-tint-green text-tint-fg-green"
                                : "bg-canvas text-obsidian-light"
                            }`}
                          >
                            {category.type === "formation" ? "Formation" : "Standard"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className="flex h-8 w-8 items-center justify-center rounded-sm bg-canvas text-obsidian-light"
                            title={ICON_LABELS[category.icon]}
                          >
                            <Icon size={16} strokeWidth={1.9} aria-label={ICON_LABELS[category.icon]} />
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Switch
                            checked={category.is_active}
                            onChange={() => toggleActive(category.id)}
                            label={`${category.is_active ? "Deactivate" : "Activate"} ${category.name_en}`}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => move(category.id, -1)}
                              disabled={index === 0}
                              aria-label={`Move ${category.name_en} up`}
                              className="rounded-pill p-1.5 text-muted transition-colors hover:bg-canvas hover:text-obsidian disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <ArrowUp size={14} strokeWidth={2.2} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => move(category.id, 1)}
                              disabled={index === categories.length - 1}
                              aria-label={`Move ${category.name_en} down`}
                              className="rounded-pill p-1.5 text-muted transition-colors hover:bg-canvas hover:text-obsidian disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <ArrowDown size={14} strokeWidth={2.2} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {confirmDeleteId === category.id ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="text-[11px] font-bold text-obsidian">Delete?</span>
                              <button
                                type="button"
                                onClick={() => deleteCategory(category.id)}
                                className="rounded-pill bg-error px-2.5 py-1.5 text-[11px] font-bold text-white transition-opacity hover:opacity-85"
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded-pill border border-border bg-white px-2.5 py-1.5 text-[11px] font-bold text-obsidian-light transition-colors hover:bg-canvas"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : isEditing ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={commitRename}
                                aria-label="Save name"
                                className="rounded-pill bg-success-tint p-2 text-tint-fg-green transition-colors hover:bg-success-tint"
                              >
                                <Check size={14} strokeWidth={2.6} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditing(null)}
                                aria-label="Cancel rename"
                                className="rounded-pill border border-border p-2 text-muted transition-colors hover:bg-canvas hover:text-obsidian"
                              >
                                <X size={14} strokeWidth={2.4} aria-hidden="true" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              {category.is_system ? (
                                <span className="chip border border-border bg-canvas text-muted" title="System category — rename only">
                                  <Lock size={11} strokeWidth={2.4} aria-hidden="true" />
                                  System — rename only
                                </span>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => startRename(category)}
                                aria-label={`Rename ${category.name_en}`}
                                className="rounded-pill p-2 text-muted transition-colors hover:bg-canvas hover:text-obsidian"
                              >
                                <Pencil size={14} strokeWidth={2} aria-hidden="true" />
                              </button>
                              {!category.is_system ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditing(null);
                                    setConfirmDeleteId(category.id);
                                  }}
                                  aria-label={`Delete ${category.name_en}`}
                                  className="rounded-pill p-2 text-muted transition-colors hover:bg-error-tint hover:text-error"
                                >
                                  <Trash size={14} strokeWidth={2} aria-hidden="true" />
                                </button>
                              ) : null}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">How categories work</h2>
            <ul className="mt-3 space-y-2.5 text-[12px] font-medium leading-snug text-obsidian-light">
              <li className="flex gap-2"><Lock size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" /> System categories (Meeting Room Rental, Formation) can be renamed, never removed.</li>
              <li className="flex gap-2"><GraduationCap size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" /> Type Formation unlocks capacity, waitlist and price label on bookings.</li>
              <li className="flex gap-2"><Check size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" /> Order set with the arrows is the order shown in booking pickers and filters.</li>
              <li className="flex gap-2"><X size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" /> Deactivating hides a category from new bookings — history keeps its label.</li>
            </ul>
          </div>
          <div className="card p-5">
            <h2 className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">Brand tints</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {TINT_ORDER.map((tintKey) => {
                const tint = TINTS[tintKey];
                return (
                  <div key={tintKey} className={`flex items-center gap-1.5 rounded-sm ${tint.swatch} px-2 py-1.5`}>
                    <span className={`h-3 w-3 rounded-pill ${tint.dot}`} aria-hidden="true" />
                    <span className={`text-[10px] font-bold ${tint.chip}`}>{tint.label}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] font-medium leading-snug text-muted">Muted pastels from the brand book — WCAG-friendly at small sizes.</p>
          </div>
        </aside>
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add category"
        description="Appears instantly in booking pickers once saved."
        footer={
          <>
            <button type="button" onClick={() => setAddOpen(false)} className="btn btn-ghost h-10 px-4 text-[13px]">Cancel</button>
            <button type="submit" form="add-category-form" className="btn btn-primary h-10 px-5 text-[13px]">Add category</button>
          </>
        }
      >
        <form id="add-category-form" onSubmit={submitAdd} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="cat-name-en" className="label">Name (EN)</label>
              <input id="cat-name-en" className="input h-11" value={draftNameEn} onChange={(e) => { setDraftNameEn(e.target.value); setDraftError(null); }} autoComplete="off" placeholder="e.g. Board meeting" />
            </div>
            <div>
              <label htmlFor="cat-name-fr" className="label">Nom (FR)</label>
              <input id="cat-name-fr" className="input h-11" value={draftNameFr} onChange={(e) => setDraftNameFr(e.target.value)} autoComplete="off" placeholder="ex. Conseil d'administration" />
            </div>
          </div>
          {draftError ? <p role="alert" className="text-[12px] font-semibold text-error">{draftError}</p> : null}
          <div>
            <label htmlFor="cat-type" className="label">Type</label>
            <select id="cat-type" className="input h-11" value={draftType} onChange={(e) => setDraftType(e.target.value as CategoryType)}>
              <option value="standard">Standard</option>
              <option value="formation">Formation</option>
            </select>
          </div>
          <div>
            <span className="label" id="cat-tint-label">Tint</span>
            <div role="radiogroup" aria-labelledby="cat-tint-label" className="flex flex-wrap gap-2">
              {TINT_ORDER.map((tintKey) => {
                const tint = TINTS[tintKey];
                const selected = draftTint === tintKey;
                return (
                  <button
                    key={tintKey}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={tint.label}
                    onClick={() => setDraftTint(tintKey)}
                    className={`flex h-10 w-10 items-center justify-center rounded-sm border ${tint.swatch} transition-all ${
                      selected ? "border-electric ring-2 ring-electric/60 ring-offset-2" : "border-border"
                    }`}
                  >
                    <span className={`h-4 w-4 rounded-pill ${tint.dot}`} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label htmlFor="cat-icon" className="label">Icon</label>
            <select id="cat-icon" className="input h-11" value={draftIcon} onChange={(e) => setDraftIcon(e.target.value as IconKey)}>
              {Object.entries(ICON_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      <ToastViewport toasts={toasts} />
    </div>
  );
}

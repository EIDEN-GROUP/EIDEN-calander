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
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/settings/PageHeader";
import { ToastViewport, useToast } from "@/components/settings/Toast";
import { Modal } from "@/components/settings/Modal";
import { Switch } from "@/components/settings/Switch";
import { DEMO_CATEGORIES } from "@/lib/demo-data";
import { useRouter } from "next/navigation";
import { createCategoryAction, toggleCategoryActiveAction, updateCategoryAction, deleteCategoryAction } from "@/app/actions/settings";

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

const TINTS: Record<TintColor, { labelKey: string; swatch: string; dot: string; chip: string }> = {
  blue: { labelKey: "tintBlue", swatch: "bg-tint-blue", dot: "bg-tint-fg-blue", chip: "text-tint-fg-blue" },
  green: { labelKey: "tintGreen", swatch: "bg-tint-green", dot: "bg-tint-fg-green", chip: "text-tint-fg-green" },
  purple: { labelKey: "tintPurple", swatch: "bg-tint-purple", dot: "bg-tint-fg-purple", chip: "text-tint-fg-purple" },
  amber: { labelKey: "tintAmber", swatch: "bg-tint-amber", dot: "bg-tint-fg-amber", chip: "text-tint-fg-amber" },
  teal: { labelKey: "tintTeal", swatch: "bg-tint-teal", dot: "bg-tint-fg-teal", chip: "text-tint-fg-teal" },
  rose: { labelKey: "tintRose", swatch: "bg-tint-rose", dot: "bg-tint-fg-rose", chip: "text-tint-fg-rose" },
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
  calendar: "iconCalendar",
  "door-open": "iconDoorOpen",
  "graduation-cap": "iconGraduationCap",
  sparkles: "iconSparkles",
  users: "iconUsers",
  wrench: "iconWrench",
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

export interface LiveCategory {
  id: string; name_en: string; name_fr: string | null; color: string; icon: string; type: "standard" | "formation"; is_system: boolean; is_active: boolean; sort: number;
}

export function CategoriesView({
  initialCategories,
  live,
}: {
  initialCategories?: LiveCategory[];
  live?: boolean;
}) {
  const t = useTranslations("settings");
  const { toasts, leaving, push } = useToast();
  const router = useRouter();
  const isLive = live === true && !!initialCategories;
  const [categories, setCategories] = useState<CategoryVM[]>(
    initialCategories
      ? initialCategories.map((c) => ({
          id: c.id, name_en: c.name_en, name_fr: c.name_fr ?? c.name_en, type: c.type, icon: c.icon as IconKey, color: (["blue", "green", "purple", "amber", "teal", "rose"].includes(c.color) ? c.color : "blue") as TintColor, is_system: c.is_system, is_active: c.is_active,
        }))
      : INITIAL_CATEGORIES,
  );
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
    if (isLive) {
      void (async () => {
        const res = await updateCategoryAction({ categoryId: id, color: next });
        if (!res.ok) push(res.error.message);
        else router.refresh();
      })();
      return;
    }
    push(t("colorUpdated", { color: t(TINTS[next].labelKey) }));
  };

  const toggleActive = (id: string) => {
    const current = categories.find((c) => c.id === id);
    if (!current) return;
    const next = !current.is_active;
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: next } : c)));
    if (isLive) {
      void (async () => {
        const res = await toggleCategoryActiveAction({ categoryId: id, isActive: next });
        if (!res.ok) {
          push(res.error.message);
          setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: !next } : c)));
          return;
        }
        push(next ? t("categoryActivated", { name: current.name_en }) : t("categoryDeactivated", { name: current.name_en }));
        router.refresh();
      })();
      return;
    }
    push(next ? t("categoryActivated", { name: current.name_en }) : t("categoryDeactivated", { name: current.name_en }));
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
    if (isLive) {
      const nextList = categories.map((c, i) => (c.id === id ? { ...c, sort: i } : c));
      void (async () => {
        for (let i = 0; i < nextList.length; i++) {
          await updateCategoryAction({ categoryId: nextList[i].id, sort: i });
        }
        router.refresh();
      })();
      return;
    }
    push(t("categoryOrderUpdated"));
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
    if (isLive) {
      void (async () => {
        const res = await updateCategoryAction({ categoryId: editing!.id, nameEn, nameFr: editing!.name_fr.trim() || nameEn });
        if (!res.ok) {
          push(res.error.message);
          return;
        }
        push(t("categoryRenamed"));
        setEditing(null);
        router.refresh();
      })();
      return;
    }
    push(t("categoryRenamed"));
    setEditing(null);
  };

  const deleteCategory = (id: string) => {
    const target = categories.find((c) => c.id === id);
    setConfirmDeleteId(null);
    if (isLive) {
      void (async () => {
        const res = await deleteCategoryAction({ categoryId: id });
        if (!res.ok) {
          push(res.error.message);
          return;
        }
        setCategories((prev) => prev.filter((c) => c.id !== id));
        if (target) push(t("categoryDeleted", { name: target.name_en }));
        router.refresh();
      })();
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== id));
    if (target) push(t("categoryDeleted", { name: target.name_en }));
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
      setDraftError(t("categoryNameRequired"));
      return;
    }
    const nameFr = draftNameFr.trim() || nameEn;
    if (isLive) {
      void (async () => {
        const res = await createCategoryAction({ nameEn, nameFr, type: draftType, color: draftTint, icon: draftIcon });
        if (!res.ok) {
          setDraftError(res.error.message);
          return;
        }
        setAddOpen(false);
        push(t("categoryAdded"));
        router.refresh();
      })();
      return;
    }
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
    push(t("categoryAdded"));
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t("tabCategories")}
        sub={t("categoriesSub")}
      >
        <button type="button" onClick={openAdd} className="btn btn-primary h-10 px-4 text-[13px]">
          <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
          {t("addCategory")}
        </button>
      </PageHeader>

      <div className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="card min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-divider px-4 py-3 sm:px-5">
            <p className="text-[12px] font-semibold text-obsidian-light">
              <span className="font-mono text-obsidian">{categories.length}</span> {t("categoriesCountBefore", { count: categories.length })} <span className="font-mono text-obsidian">{activeCount}</span> {t("categoriesActiveSuffix", { count: activeCount })}
            </p>
            <p className="text-[11px] font-medium text-muted">{t("displayOrderNote")}</p>
          </div>

          {categories.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <Calendar size={28} strokeWidth={1.8} aria-hidden="true" className="text-muted" />
              <p className="mt-3 text-[14px] font-bold text-obsidian">{t("noCategoriesTitle")}</p>
              <p className="mt-1 max-w-sm text-[12px] font-medium text-muted">{t("noCategoriesBody")}</p>
              <button type="button" onClick={openAdd} className="btn btn-primary mt-4 h-10 px-4 text-[13px]">
                <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
                {t("addCategory")}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-0 text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                    <th scope="col" className="px-4 py-2.5">{t("colColor")}</th>
                    <th scope="col" className="px-3 py-2.5">{t("colNameEn")}</th>
                    <th scope="col" className="px-3 py-2.5">{t("colNameFr")}</th>
                    <th scope="col" className="px-3 py-2.5">{t("colType")}</th>
                    <th scope="col" className="px-3 py-2.5">{t("colIcon")}</th>
                    <th scope="col" className="px-3 py-2.5">{t("colActive")}</th>
                    <th scope="col" className="px-3 py-2.5">{t("colSort")}</th>
                    <th scope="col" className="px-4 py-2.5 text-right">{t("colActions")}</th>
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
                            title={t("changeColorTitle", { color: t(tint.labelKey) })}
                            aria-label={t("changeColorAria", { name: category.name_en, color: t(tint.labelKey) })}
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
                              aria-label={t("nameInEnglish")}
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
                              aria-label={t("nameInFrench")}
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
                            title={t(ICON_LABELS[category.icon])}
                          >
                            <Icon size={16} strokeWidth={1.9} aria-label={t(ICON_LABELS[category.icon])} />
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Switch
                            checked={category.is_active}
                            onChange={() => toggleActive(category.id)}
                            label={category.is_active ? t("deactivateCategory", { name: category.name_en }) : t("activateCategory", { name: category.name_en })}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => move(category.id, -1)}
                              disabled={index === 0}
                              aria-label={t("moveUpAria", { name: category.name_en })}
                              className="rounded-pill p-2.5 text-muted transition-colors hover:bg-canvas hover:text-obsidian disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <ArrowUp size={14} strokeWidth={2.2} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => move(category.id, 1)}
                              disabled={index === categories.length - 1}
                              aria-label={t("moveDownAria", { name: category.name_en })}
                              className="rounded-pill p-2.5 text-muted transition-colors hover:bg-canvas hover:text-obsidian disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <ArrowDown size={14} strokeWidth={2.2} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {confirmDeleteId === category.id ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="text-[11px] font-bold text-obsidian">{t("deleteConfirmQuestion")}</span>
                              <button
                                type="button"
                                onClick={() => deleteCategory(category.id)}
                                className="rounded-pill border border-error/30 bg-error-tint px-2.5 py-1.5 text-[11px] font-bold text-error-fg transition-colors hover:bg-error/20"
                              >
                                {t("deleteConfirm")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded-pill border border-border bg-white px-2.5 py-1.5 text-[11px] font-bold text-obsidian-light transition-colors hover:bg-canvas"
                              >
                                {t("cancel")}
                              </button>
                            </div>
                          ) : isEditing ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={commitRename}
                                aria-label={t("saveNameAria")}
                                className="rounded-pill bg-success-tint p-2.5 text-tint-fg-green transition-colors hover:bg-success-tint/80"
                              >
                                <Check size={14} strokeWidth={2.4} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditing(null)}
                                aria-label={t("cancelRenameAria")}
                                className="rounded-pill border border-border p-2.5 text-muted transition-colors hover:bg-canvas hover:text-obsidian"
                              >
                                <X size={14} strokeWidth={2.4} aria-hidden="true" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              {category.is_system ? (
                                <span className="chip whitespace-nowrap border border-border bg-canvas text-muted" title={t("systemCategoryTitle")}>
                                  <Lock size={11} strokeWidth={2.4} aria-hidden="true" />
                                  {t("systemRenameOnly")}
                                </span>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => startRename(category)}
                                aria-label={t("renameAria", { name: category.name_en })}
                                className="rounded-pill p-2.5 text-muted transition-colors hover:bg-canvas hover:text-obsidian"
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
                                  aria-label={t("deleteAria", { name: category.name_en })}
                                  className="rounded-pill p-2.5 text-muted transition-colors hover:bg-error-tint hover:text-error-fg"
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
            <h2 className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-muted">{t("howCategoriesWork")}</h2>
            <ul className="mt-3 space-y-2.5 text-[12px] font-medium leading-snug text-obsidian-light">
              <li className="flex gap-2"><Lock size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" /> {t("howSystemCategories")}</li>
              <li className="flex gap-2"><GraduationCap size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" /> {t("howFormationType")}</li>
              <li className="flex gap-2"><Check size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" /> {t("howOrder")}</li>
              <li className="flex gap-2"><X size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" /> {t("howDeactivate")}</li>
            </ul>
          </div>
          <div className="card p-5">
            <h2 className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-muted">{t("brandTints")}</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {TINT_ORDER.map((tintKey) => {
                const tint = TINTS[tintKey];
                return (
                  <div key={tintKey} className={`flex items-center gap-1.5 rounded-sm ${tint.swatch} px-2 py-1.5`}>
                    <span className={`h-3 w-3 rounded-pill ${tint.dot}`} aria-hidden="true" />
                    <span className={`text-[11px] font-bold ${tint.chip}`}>{t(tint.labelKey)}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] font-medium leading-snug text-muted">{t("brandTintsNote")}</p>
          </div>
        </aside>
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t("addCategory")}
        description={t("addCategoryDesc")}
        footer={
          <>
            <button type="button" onClick={() => setAddOpen(false)} className="btn btn-ghost h-10 px-4 text-[13px]">{t("cancel")}</button>
            <button type="submit" form="add-category-form" className="btn btn-primary h-10 px-5 text-[13px]">{t("addCategory")}</button>
          </>
        }
      >
        <form id="add-category-form" onSubmit={submitAdd} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="cat-name-en" className="label">{t("colNameEn")}</label>
              <input id="cat-name-en" className="input h-11" value={draftNameEn} onChange={(e) => { setDraftNameEn(e.target.value); setDraftError(null); }} autoComplete="off" placeholder={t("nameEnPlaceholder")} />
            </div>
            <div>
              <label htmlFor="cat-name-fr" className="label">{t("colNameFr")}</label>
              <input id="cat-name-fr" className="input h-11" value={draftNameFr} onChange={(e) => setDraftNameFr(e.target.value)} autoComplete="off" placeholder={t("nameFrPlaceholder")} />
            </div>
          </div>
          {draftError ? <p role="alert" className="text-[12px] font-semibold text-error-fg">{draftError}</p> : null}
          <div>
            <label htmlFor="cat-type" className="label">{t("colType")}</label>
            <select id="cat-type" className="input h-11" value={draftType} onChange={(e) => setDraftType(e.target.value as CategoryType)}>
              <option value="standard">Standard</option>
              <option value="formation">Formation</option>
            </select>
          </div>
          <div>
            <span className="label" id="cat-tint-label">{t("tintLabel")}</span>
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
                    aria-label={t(tint.labelKey)}
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
            <label htmlFor="cat-icon" className="label">{t("iconLabel")}</label>
            <select id="cat-icon" className="input h-11" value={draftIcon} onChange={(e) => setDraftIcon(e.target.value as IconKey)}>
              {Object.entries(ICON_LABELS).map(([key, labelKey]) => (
                <option key={key} value={key}>{t(labelKey)}</option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      <ToastViewport toasts={toasts} leaving={leaving} />
    </div>
  );
}

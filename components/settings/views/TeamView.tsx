"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  KeyRound,
  Lock,
  Mail,
  Plus,
  ShieldCheck,
  TriangleExclamationPoint,
  UserRoundPen,
  UserRoundX,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/settings/PageHeader";
import { createTeamUserAction, setTeamUserActiveAction, updateTeamUserAction } from "@/app/actions/settings";
import { ToastViewport, useToast } from "@/components/settings/Toast";
import { Modal } from "@/components/settings/Modal";

type Role = "admin" | "staff";
type Status = "active" | "deactivated";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  lastActive: string;
  status: Status;
  you?: boolean;
}

const INITIAL_TEAM: TeamMember[] = [
  { id: "usr-marouane", name: "Marouane A.", email: "contact@eiden-group.com", phone: "+212 5 22 00 00 00", role: "admin", lastActive: "Active now", status: "active", you: true },
  { id: "usr-yasmine", name: "Yasmine B.", email: "yasmine.b@eiden-group.com", phone: "+212 6 12 34 56 78", role: "staff", lastActive: "2 h ago", status: "active" },
  { id: "usr-karim", name: "Karim L.", email: "karim.l@eiden-group.com", phone: "+212 6 98 76 54 32", role: "staff", lastActive: "Yesterday, 18:12", status: "active" },
  { id: "usr-sofia", name: "Sofia T.", email: "sofia.t@eiden-group.com", phone: "+212 6 55 44 33 22", role: "staff", lastActive: "3 weeks ago", status: "deactivated" },
];

export interface LiveMember {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function initials(name: string): string {
  const parts = name.replace(/\./g, "").trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function generateTempPassword(length = 14): string {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  let out = "";
  for (let i = 0; i < length; i++) out += PASSWORD_ALPHABET[values[i] % PASSWORD_ALPHABET.length];
  return out;
}

export function TeamView({
  members,
  currentUserId,
  live,
}: {
  members?: LiveMember[];
  currentUserId?: string | null;
  live?: boolean;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const isLive = live === true && !!members;
  const initialTeam: TeamMember[] = isLive
    ? members!.map((m) => ({
        id: m.id,
        name: m.full_name,
        email: m.email,
        phone: m.phone ?? "",
        role: m.role,
        lastActive: m.is_active ? t("lastActiveActive") : t("lastActiveDeactivated"),
        status: m.is_active ? ("active" as const) : ("deactivated" as const),
        you: m.id === currentUserId,
      }))
    : INITIAL_TEAM;
  const { toasts, leaving, push } = useToast();
  const [team, setTeam] = useState<TeamMember[]>(initialTeam);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // Edit modal
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<Role>("staff");
  const [editPhone, setEditPhone] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Create modal (two stages: form -> one-time password)
  const [createOpen, setCreateOpen] = useState(false);
  const [createStage, setCreateStage] = useState<"form" | "password">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [formError, setFormError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [pendingMember, setPendingMember] = useState<TeamMember | null>(null);

  const activeCount = useMemo(() => team.filter((m) => m.status === "active").length, [team]);

  const openEdit = (member: TeamMember) => {
    setEditing(member);
    setEditName(member.name);
    setEditRole(member.role);
    setEditPhone(member.phone);
    setEditError(null);
  };

  const submitEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError(t("nameRequired"));
      return;
    }
    if (isLive) {
      void (async () => {
        const res = await updateTeamUserAction({ userId: editing.id, fullName: trimmed, role: editRole, phone: editPhone.trim() || null });
        if (!res.ok) {
          setEditError(res.error.message);
          return;
        }
        push(t("userUpdated"));
        setEditing(null);
        router.refresh();
      })();
      return;
    }
    setTeam((prev) =>
      prev.map((m) => (m.id === editing.id ? { ...m, name: trimmed, role: editRole, phone: editPhone.trim() } : m)),
    );
    setEditing(null);
    push(t("userUpdated"));
  };

  const toggleDeactivate = (member: TeamMember) => {
    const next: Status = member.status === "active" ? "deactivated" : "active";
    setConfirmId(null);
    if (isLive) {
      void (async () => {
        const res = await setTeamUserActiveAction({ userId: member.id, isActive: next === "active" });
        if (!res.ok) {
          push(res.error.message);
          return;
        }
        push(next === "deactivated" ? t("userDeactivatedSessions", { name: member.name }) : t("userReactivated", { name: member.name }));
        setTeam((prev) => prev.map((m) => (m.id === member.id ? { ...m, status: next } : m)));
        router.refresh();
      })();
      return;
    }
    setTeam((prev) => prev.map((m) => (m.id === member.id ? { ...m, status: next } : m)));
    push(next === "deactivated" ? t("userDeactivatedSessions", { name: member.name }) : t("userReactivated", { name: member.name }));
  };

  const openCreate = () => {
    setCreateStage("form");
    setName("");
    setEmail("");
    setRole("staff");
    setFormError(null);
    setTempPassword("");
    setCopied(false);
    setPendingMember(null);
    setCreateOpen(true);
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName) {
      setFormError(t("fullNameRequired"));
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      setFormError(t("invalidEmail"));
      return;
    }
    if (team.some((m) => m.email.toLowerCase() === trimmedEmail)) {
      setFormError(t("userExists", { email: trimmedEmail }));
      return;
    }
    if (isLive) {
      const res = await createTeamUserAction({ fullName: trimmedName, email: trimmedEmail, role });
      if (!res.ok) {
        setFormError(res.error.code === "duplicate" ? t("accountExists") : res.error.message);
        return;
      }
      setTempPassword(res.data.tempPassword);
      setPendingMember({
        id: res.data.userId,
        name: trimmedName,
        email: trimmedEmail,
        phone: "",
        role,
        lastActive: t("lastActiveJustNow"),
        status: "active",
      });
      setCreateStage("password");
      router.refresh();
      return;
    }
    const password = generateTempPassword(14);
    setTempPassword(password);
    setPendingMember({
      id: `usr-${Date.now().toString(36)}`,
      name: trimmedName,
      email: trimmedEmail,
      phone: "",
      role,
      lastActive: t("lastActiveJustNow"),
      status: "active",
    });
    setCreateStage("password");
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setFormError(t("clipboardUnavailable"));
    }
  };

  const finishCreate = () => {
    if (pendingMember) {
      setTeam((prev) => [...prev, pendingMember]);
      push(t("userCreated", { name: pendingMember.name }));
    }
    setCreateOpen(false);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t("tabTeam")}
        sub={t("teamSub")}
      >
        <span className="chip bg-obsidian text-[11px] uppercase tracking-[0.08em] text-white">{t("adminBadge")}</span>
        <button type="button" onClick={openCreate} className="btn btn-primary h-10 px-4 text-[13px]">
          <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
          {t("createUser")}
        </button>
      </PageHeader>

      <div className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-divider px-4 py-3 sm:px-5">
            <p className="text-[12px] font-semibold text-obsidian-light">
              <span className="font-mono text-obsidian">{team.length}</span> {t("usersCountBefore", { count: team.length })} <span className="font-mono text-obsidian">{activeCount}</span> {t("usersActiveSuffix", { count: activeCount })}
            </p>
            <p className="text-[11px] font-medium text-muted">{t("rolesGateNote")}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                  <th scope="col" className="px-4 py-2.5 sm:px-5">{t("colUser")}</th>
                  <th scope="col" className="px-3 py-2.5">{t("colRole")}</th>
                  <th scope="col" className="px-3 py-2.5">{t("colLastActive")}</th>
                  <th scope="col" className="px-3 py-2.5">{t("colStatus")}</th>
                  <th scope="col" className="px-4 py-2.5 text-right">{t("colActions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {team.map((member) => {
                  const deactivated = member.status === "deactivated";
                  const confirming = confirmId === member.id;
                  return (
                    <tr key={member.id} className={`align-middle transition-colors hover:bg-canvas/60 ${deactivated ? "opacity-70" : ""}`}>
                      <td className="px-4 py-3 sm:px-5">
                        <div className="flex items-center gap-2.5">
                          <span
                            aria-hidden="true"
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-pill text-[11px] font-extrabold tracking-wide ${
                              member.role === "admin" ? "bg-obsidian text-white" : "bg-tint-blue text-tint-fg-blue"
                            }`}
                          >
                            {initials(member.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 font-semibold leading-tight text-obsidian">
                              {member.name}
                              {member.you ? <span className="rounded-pill bg-canvas px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{t("youBadge")}</span> : null}
                            </p>
                            <p title={member.email} className="mt-0.5 flex items-center gap-1 truncate font-mono text-[11px] text-muted">
                              <Mail size={10} strokeWidth={2.2} aria-hidden="true" className="shrink-0" />
                              {member.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={member.role === "admin" ? "chip bg-obsidian text-white" : "chip border border-border bg-white text-obsidian-light"}>
                          {member.role === "admin" ? t("roleAdmin") : t("roleStaff")}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[12px] font-medium text-obsidian-light">{member.lastActive}</td>
                      <td className="px-3 py-3">
                        {deactivated ? (
                          <span className="chip bg-canvas text-muted">
                            <span className="h-1.5 w-1.5 rounded-pill bg-muted" aria-hidden="true" />
                            {t("statusDeactivated")}
                          </span>
                        ) : (
                          <span className="chip bg-success-tint text-tint-fg-green">
                            <span className="h-1.5 w-1.5 rounded-pill bg-success" aria-hidden="true" />
                            {t("statusActive")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {confirming ? (
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <span className="text-[11px] font-bold text-obsidian">{deactivated ? t("reactivateQuestion") : t("deactivateQuestion")}</span>
                            <button
                              type="button"
                              onClick={() => toggleDeactivate(member)}
                              className="rounded-pill bg-error px-2.5 py-1.5 text-[11px] font-bold text-white transition-opacity hover:opacity-85"
                            >
                              {deactivated ? t("reactivateButton") : t("deactivateButton")}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmId(null)}
                              className="rounded-pill border border-border bg-white px-2.5 py-1.5 text-[11px] font-bold text-obsidian-light transition-colors hover:bg-canvas"
                            >
                              {t("cancel")}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEdit(member)}
                              aria-label={t("editUserAria", { name: member.name })}
                              className="rounded-pill p-2 text-muted transition-colors hover:bg-canvas hover:text-obsidian"
                            >
                              <UserRoundPen size={15} strokeWidth={2} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmId(member.id)}
                              disabled={member.you}
                              title={member.you ? t("youCantDeactivateSelf") : deactivated ? t("reactivateUserAria", { name: member.name }) : t("deactivateUserAria", { name: member.name })}
                              aria-label={deactivated ? t("reactivateUserAria", { name: member.name }) : t("deactivateUserAria", { name: member.name })}
                              className="rounded-pill p-2 text-muted transition-colors hover:bg-error-tint hover:text-error-fg disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted"
                            >
                              {deactivated ? <ShieldCheck size={15} strokeWidth={2} aria-hidden="true" /> : <UserRoundX size={15} strokeWidth={2} aria-hidden="true" />}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="flex items-center gap-2 border-t border-divider px-4 py-3 text-[11px] font-medium leading-snug text-muted sm:px-5">
            <Lock size={12} strokeWidth={2.2} aria-hidden="true" className="shrink-0" />
            {t("passwordsOneTimeNote")}
          </p>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-muted">{t("accessControlHeading")}</h2>
            <ul className="mt-3 space-y-2.5 text-[12px] font-medium leading-snug text-obsidian-light">
              <li className="flex gap-2"><ShieldCheck size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />{t("accessAdmins")}</li>
              <li className="flex gap-2"><ShieldCheck size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />{t("accessStaff")}</li>
              <li className="flex gap-2"><Lock size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />{t("accessDeactivate")}</li>
              <li className="flex gap-2"><KeyRound size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />{t("accessFirstLogin")}</li>
            </ul>
            <Link href="/settings/audit" className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold text-electric hover:text-electric-hover">
              {t("viewAuditLog")}
              <ArrowRight size={12} strokeWidth={2.4} aria-hidden="true" />
            </Link>
          </div>
        </aside>
      </div>

      {/* Edit modal */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={t("editUser")}
        description={t("editUserDesc")}
        footer={
          <>
            <button type="button" onClick={() => setEditing(null)} className="btn btn-ghost h-10 px-4 text-[13px]">{t("cancel")}</button>
            <button type="submit" form="edit-user-form" className="btn btn-primary h-10 px-5 text-[13px]">{t("saveChanges")}</button>
          </>
        }
      >
        <form id="edit-user-form" onSubmit={submitEdit} className="space-y-4">
          <div>
            <label htmlFor="edit-user-name" className="label">{t("fullNameLabel")}</label>
            <input id="edit-user-name" className="input h-11" value={editName} onChange={(e) => { setEditName(e.target.value); setEditError(null); }} autoComplete="name" />
          </div>
          <div>
            <span className="label">{t("emailLabel")}</span>
            <p className="flex h-11 items-center gap-2 rounded-[14px] border border-border bg-canvas px-4 font-mono text-[12px] font-semibold text-muted">
              <Lock size={12} strokeWidth={2.2} aria-hidden="true" />
              {editing?.email}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-user-role" className="label">{t("roleLabel")}</label>
              <select id="edit-user-role" className="input h-11" value={editRole} onChange={(e) => setEditRole(e.target.value as Role)}>
                <option value="admin">{t("roleAdmin")}</option>
                <option value="staff">{t("roleStaff")}</option>
              </select>
            </div>
            <div>
              <label htmlFor="edit-user-phone" className="label">{t("phoneLabel")}</label>
              <input id="edit-user-phone" type="tel" className="input h-11 font-mono text-[13px]" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+212 6 …" />
            </div>
          </div>
          {editError ? <p role="alert" className="text-[12px] font-semibold text-error-fg">{editError}</p> : null}
        </form>
      </Modal>

      {/* Create modal: stage 1: form, stage 2: one-time password */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={createStage === "form" ? t("createUser") : t("oneTimePasswordTitle")}
        description={createStage === "form" ? t("createUserDesc") : t("copyPasswordDesc")}
        footer={
          createStage === "form" ? (
            <>
              <button type="button" onClick={() => setCreateOpen(false)} className="btn btn-ghost h-10 px-4 text-[13px]">{t("cancel")}</button>
              <button type="submit" form="create-user-form" className="btn btn-primary h-10 px-5 text-[13px]">{t("createUser")}</button>
            </>
          ) : (
            <button type="button" onClick={finishCreate} className="btn btn-primary h-10 px-6 text-[13px]">{t("doneButton")}</button>
          )
        }
      >
        {createStage === "form" ? (
          <form id="create-user-form" onSubmit={submitCreate} className="space-y-4" noValidate>
            <div>
              <label htmlFor="create-user-name" className="label">{t("fullNameLabel")}</label>
              <input id="create-user-name" className="input h-11" value={name} onChange={(e) => { setName(e.target.value); setFormError(null); }} placeholder="e.g. Omar Tazi" autoComplete="name" />
            </div>
            <div>
              <label htmlFor="create-user-email" className="label">{t("emailLabel")}</label>
              <input id="create-user-email" type="email" className="input h-11 font-mono text-[13px]" value={email} onChange={(e) => { setEmail(e.target.value); setFormError(null); }} placeholder="name@eiden-group.com" autoComplete="email" />
            </div>
            <div>
              <label htmlFor="create-user-role" className="label">{t("roleLabel")}</label>
              <select id="create-user-role" className="input h-11" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="admin">{t("roleAdminFull")}</option>
                <option value="staff">{t("roleStaffScope")}</option>
              </select>
            </div>
            {formError ? <p role="alert" className="text-[12px] font-semibold text-error-fg">{formError}</p> : null}
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-obsidian px-4 py-5 text-center shadow-md">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/60">{t("temporaryPasswordLabel")}</p>
              <p className="mt-2 select-all font-mono text-[26px] font-bold leading-tight tracking-[0.08em] text-white" aria-label={t("temporaryPasswordAria", { password: tempPassword })}>
                {tempPassword}
              </p>
              <p className="mt-2 text-[11px] font-medium text-white/50">{pendingMember?.email}</p>
            </div>
            <button
              type="button"
              onClick={copyPassword}
              className="btn btn-secondary h-10 w-full text-[13px]"
              aria-live="polite"
            >
              {copied ? <Check size={15} strokeWidth={2.4} aria-hidden="true" className="text-tint-fg-green" /> : <Copy size={15} strokeWidth={2.2} aria-hidden="true" />}
              {copied ? t("copiedToClipboard") : t("copyPasswordButton")}
            </button>
            <div role="alert" className="flex items-start gap-2 rounded-sm border border-warning/40 bg-warning-tint p-3 text-[12px] font-semibold leading-snug text-tint-fg-amber">
              <TriangleExclamationPoint size={15} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 shrink-0" />
              {t("tempPasswordShownOnce")}
            </div>
          </div>
        )}
      </Modal>

      <ToastViewport toasts={toasts} leaving={leaving} />
    </div>
  );
}

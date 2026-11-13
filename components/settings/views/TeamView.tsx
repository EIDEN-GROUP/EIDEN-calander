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
import { PageHeader } from "@/components/settings/PageHeader";
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

export function TeamView() {
  const { toasts, push } = useToast();
  const [team, setTeam] = useState<TeamMember[]>(INITIAL_TEAM);
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
      setEditError("Name is required.");
      return;
    }
    setTeam((prev) =>
      prev.map((m) => (m.id === editing.id ? { ...m, name: trimmed, role: editRole, phone: editPhone.trim() } : m)),
    );
    setEditing(null);
    push("User updated (demo)");
  };

  const toggleDeactivate = (member: TeamMember) => {
    const next: Status = member.status === "active" ? "deactivated" : "active";
    setTeam((prev) => prev.map((m) => (m.id === member.id ? { ...m, status: next } : m)));
    setConfirmId(null);
    push(
      next === "deactivated"
        ? `${member.name} deactivated (demo) — all sessions revoked`
        : `${member.name} reactivated (demo)`,
    );
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

  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName) {
      setFormError("Full name is required.");
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      setFormError("Enter a valid email address, e.g. name@eiden-group.com.");
      return;
    }
    if (team.some((m) => m.email.toLowerCase() === trimmedEmail)) {
      setFormError(`A user with ${trimmedEmail} already exists.`);
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
      lastActive: "Just now",
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
      setFormError("Clipboard unavailable — select the password and copy it manually.");
    }
  };

  const finishCreate = () => {
    if (pendingMember) {
      setTeam((prev) => [...prev, pendingMember]);
      push(`${pendingMember.name} created (demo) — temp password shown once`);
    }
    setCreateOpen(false);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Team & Users"
        sub="The only place staff accounts are managed. One-time passwords are issued at creation and never shown again."
      >
        <span className="chip bg-obsidian text-[10px] uppercase tracking-[0.12em] text-white">Admin</span>
        <button type="button" onClick={openCreate} className="btn btn-primary h-10 px-4 text-[13px]">
          <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
          Create user
        </button>
      </PageHeader>

      <div className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-divider px-4 py-3 sm:px-5">
            <p className="text-[12px] font-semibold text-obsidian-light">
              <span className="font-mono text-obsidian">{team.length}</span> users ·{" "}
              <span className="font-mono text-obsidian">{activeCount}</span> active
            </p>
            <p className="text-[11px] font-medium text-muted">Roles gate everything — Admin and Staff</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
                  <th scope="col" className="px-4 py-2.5 sm:px-5">User</th>
                  <th scope="col" className="px-3 py-2.5">Role</th>
                  <th scope="col" className="px-3 py-2.5">Last active</th>
                  <th scope="col" className="px-3 py-2.5">Status</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Actions</th>
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
                              {member.you ? <span className="rounded-pill bg-canvas px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-muted">You</span> : null}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1 truncate font-mono text-[11px] text-muted">
                              <Mail size={10} strokeWidth={2.2} aria-hidden="true" className="shrink-0" />
                              {member.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={member.role === "admin" ? "chip bg-obsidian text-white" : "chip border border-border bg-white text-obsidian-light"}>
                          {member.role === "admin" ? "Admin" : "Staff"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[12px] font-medium text-obsidian-light">{member.lastActive}</td>
                      <td className="px-3 py-3">
                        {deactivated ? (
                          <span className="chip bg-canvas text-muted">
                            <span className="h-1.5 w-1.5 rounded-pill bg-muted" aria-hidden="true" />
                            Deactivated
                          </span>
                        ) : (
                          <span className="chip bg-success-tint text-tint-fg-green">
                            <span className="h-1.5 w-1.5 rounded-pill bg-success" aria-hidden="true" />
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {confirming ? (
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <span className="text-[11px] font-bold text-obsidian">{deactivated ? "Reactivate?" : "Deactivate?"}</span>
                            <button
                              type="button"
                              onClick={() => toggleDeactivate(member)}
                              className="rounded-pill bg-error px-2.5 py-1.5 text-[11px] font-bold text-white transition-opacity hover:opacity-85"
                            >
                              {deactivated ? "Reactivate" : "Deactivate"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmId(null)}
                              className="rounded-pill border border-border bg-white px-2.5 py-1.5 text-[11px] font-bold text-obsidian-light transition-colors hover:bg-canvas"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEdit(member)}
                              aria-label={`Edit ${member.name}`}
                              className="rounded-pill p-2 text-muted transition-colors hover:bg-canvas hover:text-obsidian"
                            >
                              <UserRoundPen size={15} strokeWidth={2} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmId(member.id)}
                              disabled={member.you}
                              title={member.you ? "You can't deactivate your own account" : deactivated ? `Reactivate ${member.name}` : `Deactivate ${member.name}`}
                              aria-label={deactivated ? `Reactivate ${member.name}` : `Deactivate ${member.name}`}
                              className="rounded-pill p-2 text-muted transition-colors hover:bg-error-tint hover:text-error disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted"
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
            Passwords are one-time; you never see them again after close. Accounts are provisioned here only — Supabase Auth issues the sessions.
          </p>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">Access control</h2>
            <ul className="mt-3 space-y-2.5 text-[12px] font-medium leading-snug text-obsidian-light">
              <li className="flex gap-2"><ShieldCheck size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />Admins create, edit, deactivate users and see audit logs.</li>
              <li className="flex gap-2"><ShieldCheck size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />Staff manage bookings, clients and formations — nothing else.</li>
              <li className="flex gap-2"><Lock size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />Deactivating revokes all sessions and signs the user out everywhere.</li>
              <li className="flex gap-2"><KeyRound size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />First login forces a password change — the one-time value is useless after.</li>
            </ul>
            <Link href="/settings/audit" className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold text-electric hover:text-electric-hover">
              View audit log
              <ArrowRight size={12} strokeWidth={2.4} aria-hidden="true" />
            </Link>
          </div>
        </aside>
      </div>

      {/* Edit modal */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit user"
        description="Email is the login identifier and can't be changed here."
        footer={
          <>
            <button type="button" onClick={() => setEditing(null)} className="btn btn-ghost h-10 px-4 text-[13px]">Cancel</button>
            <button type="submit" form="edit-user-form" className="btn btn-primary h-10 px-5 text-[13px]">Save changes</button>
          </>
        }
      >
        <form id="edit-user-form" onSubmit={submitEdit} className="space-y-4">
          <div>
            <label htmlFor="edit-user-name" className="label">Full name</label>
            <input id="edit-user-name" className="input h-11" value={editName} onChange={(e) => { setEditName(e.target.value); setEditError(null); }} autoComplete="name" />
          </div>
          <div>
            <span className="label">Email</span>
            <p className="flex h-11 items-center gap-2 rounded-[14px] border border-border bg-canvas px-4 font-mono text-[12px] font-semibold text-muted">
              <Lock size={12} strokeWidth={2.2} aria-hidden="true" />
              {editing?.email}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-user-role" className="label">Role</label>
              <select id="edit-user-role" className="input h-11" value={editRole} onChange={(e) => setEditRole(e.target.value as Role)}>
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
              </select>
            </div>
            <div>
              <label htmlFor="edit-user-phone" className="label">Phone</label>
              <input id="edit-user-phone" type="tel" className="input h-11 font-mono text-[13px]" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+212 6 …" />
            </div>
          </div>
          {editError ? <p role="alert" className="text-[12px] font-semibold text-error">{editError}</p> : null}
        </form>
      </Modal>

      {/* Create modal — stage 1: form, stage 2: one-time password */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={createStage === "form" ? "Create user" : "One-time password"}
        description={createStage === "form" ? "The user gets a temporary password valid for first login only." : "Copy it now — it will never be shown again."}
        footer={
          createStage === "form" ? (
            <>
              <button type="button" onClick={() => setCreateOpen(false)} className="btn btn-ghost h-10 px-4 text-[13px]">Cancel</button>
              <button type="submit" form="create-user-form" className="btn btn-primary h-10 px-5 text-[13px]">Create user</button>
            </>
          ) : (
            <button type="button" onClick={finishCreate} className="btn btn-primary h-10 px-6 text-[13px]">Done</button>
          )
        }
      >
        {createStage === "form" ? (
          <form id="create-user-form" onSubmit={submitCreate} className="space-y-4" noValidate>
            <div>
              <label htmlFor="create-user-name" className="label">Full name</label>
              <input id="create-user-name" className="input h-11" value={name} onChange={(e) => { setName(e.target.value); setFormError(null); }} placeholder="e.g. Omar Tazi" autoComplete="name" />
            </div>
            <div>
              <label htmlFor="create-user-email" className="label">Email</label>
              <input id="create-user-email" type="email" className="input h-11 font-mono text-[13px]" value={email} onChange={(e) => { setEmail(e.target.value); setFormError(null); }} placeholder="name@eiden-group.com" autoComplete="email" />
            </div>
            <div>
              <label htmlFor="create-user-role" className="label">Role</label>
              <select id="create-user-role" className="input h-11" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="admin">Admin — full access</option>
                <option value="staff">Staff — bookings, clients, formations</option>
              </select>
            </div>
            {formError ? <p role="alert" className="text-[12px] font-semibold text-error">{formError}</p> : null}
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-obsidian px-4 py-5 text-center shadow-md">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Temporary password</p>
              <p className="mt-2 select-all font-mono text-[26px] font-bold leading-tight tracking-[0.08em] text-white" aria-label={`Temporary password: ${tempPassword}`}>
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
              {copied ? <Check size={15} strokeWidth={2.6} aria-hidden="true" className="text-success" /> : <Copy size={15} strokeWidth={2.2} aria-hidden="true" />}
              {copied ? "Copied to clipboard" : "Copy password"}
            </button>
            <div role="alert" className="flex items-start gap-2 rounded-sm border border-warning/40 bg-warning-tint p-3 text-[12px] font-semibold leading-snug text-tint-fg-amber">
              <TriangleExclamationPoint size={15} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 shrink-0" />
              Shown once — store it now. The user must change it at first login.
            </div>
          </div>
        )}
      </Modal>

      <ToastViewport toasts={toasts} />
    </div>
  );
}

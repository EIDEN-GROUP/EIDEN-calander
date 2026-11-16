"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";
import { login, type LoginState } from "./actions";
import { useTranslations } from "next-intl";

const initialState: LoginState = { ok: false, configured: true };

const fieldLabel =
  "mb-2 block text-[13px] font-semibold tracking-[-0.01em] text-obsidian";
const pillInput =
  "h-[50px] w-full rounded-pill border-[1.5px] border-[rgba(29,29,31,0.14)] bg-white px-[22px] text-[15px] text-obsidian outline-none transition placeholder:text-[#86868B] hover:border-[rgba(29,29,31,0.32)] focus:border-electric focus:shadow-[0_0_0_4px_rgba(0,102,204,0.12)]";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const t = useTranslations("login");
  const [state, formAction, pending] = useActionState(login, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="w-full" noValidate>
      <input type="hidden" name="next" value={nextPath} />

      {/* Email */}
      <label htmlFor="email" className={fieldLabel}>
        {t("email")}
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        placeholder="you@eiden-group.com"
        className={pillInput}
        aria-describedby={state.errorKey ? "login-error" : undefined}
      />

      {/* Password */}
      <label htmlFor="password" className={`${fieldLabel} mt-5`}>
        {t("password")}
      </label>
      <div className="relative">
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          placeholder="••••••••••"
          className={`${pillInput} pr-[56px]`}
          aria-describedby={state.errorKey ? "login-error" : undefined}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? t("hidePassword") : t("showPassword")}
          aria-pressed={showPassword}
          className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-obsidian-light transition hover:scale-[1.06] hover:bg-canvas hover:text-obsidian active:scale-[0.94]"
        >
          {showPassword ? (
            <EyeOff size={19} strokeWidth={1.8} aria-hidden="true" />
          ) : (
            <Eye size={19} strokeWidth={1.8} aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Forgot password */}
      <div className="mt-2.5 flex justify-end">
        <a
          href="/forgot-password"
          className="px-0.5 py-1 text-[13px] font-semibold text-obsidian underline decoration-black/20 underline-offset-[3px] transition-colors hover:text-electric"
        >
          {t("forgot")}
        </a>
      </div>

      {/* Error */}
      {state.errorKey && (
        <div
          id="login-error"
          role="alert"
          aria-live="assertive"
          className="mt-4 flex items-start gap-2.5 rounded-sm border border-error/20 bg-error-tint px-4 py-3 text-[13px] font-medium leading-snug text-[#c22a22]"
        >
          <AlertCircle size={17} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{state.errorKey ? t(state.errorKey) : null}</span>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={pending}
        className="mt-5 flex h-[52px] w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-pill bg-electric text-[16px] font-semibold tracking-[-0.01em] text-white transition hover:scale-[1.02] hover:bg-electric-hover hover:shadow-[0_8px_24px_rgba(0,102,204,0.3)] active:scale-[0.99] disabled:cursor-wait disabled:opacity-80"
      >
        {pending ? (
          <>
            <Loader2 size={19} className="animate-spin" aria-hidden="true" />
            {t("signingIn")}
          </>
        ) : (
          t("signIn")
        )}
      </button>
    </form>
  );
}

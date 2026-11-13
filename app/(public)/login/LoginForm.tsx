"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { ok: false, configured: true };

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="w-full" noValidate>
      <input type="hidden" name="next" value={nextPath} />

      {/* Email */}
      <label htmlFor="email" className="label">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        placeholder="you@eiden-group.com"
        className="input-pill"
        aria-describedby={state.error ? "login-error" : undefined}
      />

      {/* Password */}
      <label htmlFor="password" className="label mt-5">
        Password
      </label>
      <div className="relative">
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          placeholder="••••••••••"
          className="input-pill pr-14"
          aria-describedby={state.error ? "login-error" : undefined}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          className="absolute right-5 top-1/2 -translate-y-1/2 text-obsidian-light transition-colors hover:text-obsidian"
        >
          {showPassword ? <EyeOff size={20} strokeWidth={1.8} /> : <Eye size={20} strokeWidth={1.8} />}
        </button>
      </div>

      {/* Forgot password */}
      <div className="mt-2.5 flex justify-end">
        <a
          href="/forgot-password"
          className="text-[13px] font-semibold text-obsidian-light underline decoration-black/20 underline-offset-2 transition-colors hover:text-electric"
        >
          Forgot password?
        </a>
      </div>

      {/* Error */}
      {state.error && (
        <div
          id="login-error"
          role="alert"
          aria-live="assertive"
          className="mt-4 flex items-start gap-2.5 rounded-sm border border-error/20 bg-error-tint px-4 py-3 text-[13px] font-medium leading-snug text-[#c22a22]"
        >
          <AlertCircle size={17} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary mt-6 h-[52px] w-full rounded-pill text-[17px] tracking-[-0.01em] disabled:cursor-wait disabled:opacity-80"
      >
        {pending ? (
          <>
            <Loader2 size={19} className="animate-spin" aria-hidden="true" />
            Signing in…
          </>
        ) : (
          "Log in"
        )}
      </button>
    </form>
  );
}

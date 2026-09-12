import { Eye, EyeOff, Stethoscope } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { credentialsSchema, registrationSchema } from "@ccs/validation";
import { useAuthentication, type AuthenticationMode } from "../hooks";
import { ApiError } from "../api";

const fieldClass = "h-11 w-full min-w-0 border border-[#9eabb3] bg-white px-3 font-normal focus:outline-2 focus:outline-[#2c627f]";

export function Login({ mode = "login" }: { mode?: AuthenticationMode }) {
  const mutation = useAuthentication(mode);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const registering = mode === "register";
  const fieldError = (name: string) => errors[name] && <span id={name + "-error"} className="text-xs font-normal text-red-700">{errors[name]}</span>;
  return <main className="min-h-screen bg-[#f1f3f4] text-[#18242b]">
    <header className="flex min-h-16 items-center gap-3 border-b border-[#a8b4bb] bg-white px-5 text-lg font-bold text-[#1e465e]"><Stethoscope size={26} />ClinSim CCS</header>
    <section className="mx-auto w-full max-w-[480px] px-5 py-10 sm:py-14">
      <h1 className="text-3xl font-bold">{registering ? "Create your account" : "Sign in"}</h1>
      <p className="mb-7 mt-2 text-sm text-[#60717d]">{registering ? "Start your clinical case practice." : "Welcome back to ClinSim CCS."}</p>
      <form noValidate onSubmit={event => {
        event.preventDefault();
        if (mutation.isPending) return;
        const values = Object.fromEntries(new FormData(event.currentTarget));
        const parsed = (registering ? registrationSchema : credentialsSchema).safeParse(values);
        if (!parsed.success) {
          const next: Record<string, string> = {};
          for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
          setErrors(next); return;
        }
        setErrors({}); mutation.mutate(parsed.data);
      }}>
        <fieldset disabled={mutation.isPending} className="space-y-4 disabled:opacity-70">
          {registering && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{[["firstName", "First name", "given-name"], ["lastName", "Last name", "family-name"]].map(([name, label, autocomplete]) => <label key={name} className="grid gap-1.5 text-sm font-semibold">{label}<input className={fieldClass} name={name} autoComplete={autocomplete} maxLength={100} required aria-invalid={!!errors[name]} aria-describedby={errors[name] ? name + "-error" : undefined} />{fieldError(name)}</label>)}</div>}
          <label className="grid gap-1.5 text-sm font-semibold">Email<input className={fieldClass} type="email" name="email" autoComplete="email" inputMode="email" maxLength={254} required aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} />{fieldError("email")}</label>
          <label className="grid gap-1.5 text-sm font-semibold">Password<div className="relative"><input className={fieldClass + " pr-12"} type={showPassword ? "text" : "password"} name="password" autoComplete={registering ? "new-password" : "current-password"} minLength={8} maxLength={128} required aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : registering ? "password-hint" : undefined} /><button type="button" className="absolute right-0 top-0 grid h-11 w-11 place-items-center text-[#60717d]" title={showPassword ? "Hide password" : "Show password"} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{registering && <span id="password-hint" className="text-xs font-normal text-[#60717d]">Use at least 8 characters.</span>}{fieldError("password")}</label>
          {registering && <label className="grid gap-1.5 text-sm font-semibold">Confirm password<input className={fieldClass} type={showPassword ? "text" : "password"} name="confirmPassword" autoComplete="new-password" maxLength={128} required aria-invalid={!!errors.confirmPassword} aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined} />{fieldError("confirmPassword")}</label>}
          {mutation.error && <p role="alert" className="border border-red-300 bg-red-50 p-3 text-sm text-red-800">{mutation.error instanceof ApiError && mutation.error.status === 429 ? "Too many attempts. Please wait a few minutes and try again." : mutation.error.message}</p>}
          <button className="min-h-11 w-full border border-[#153548] bg-[#1e465e] px-4 py-2 font-bold text-white disabled:opacity-60" disabled={mutation.isPending}>{mutation.isPending ? (registering ? "Creating account..." : "Signing in...") : registering ? "Sign up" : "Sign in"}</button>
        </fieldset>
      </form>
      <p className="mt-5 text-center text-sm">{registering ? "Already have an account? " : "Don't have an account? "}<Link className="font-semibold text-[#2c627f] underline" to={registering ? "/login" : "/signup"}>{registering ? "Sign in" : "Sign up"}</Link></p>
      <p className="mt-10 text-center text-xs text-[#60717d]">Independent educational software. Not affiliated with USMLE or NBME.</p>
    </section>
  </main>;
}

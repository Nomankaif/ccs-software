import { Stethoscope } from "lucide-react";
import { useState } from "react";
import { useAuthentication, type AuthenticationMode } from "../hooks";

export function Login() {
  const [mode, setMode] = useState<AuthenticationMode>("login");
  const mutation = useAuthentication(mode);
  return (
    <main className="grid min-h-screen place-items-center bg-[#e4e9ec] font-sans text-[#18242b]">
      <section className="w-[380px] border border-[#a8b4bb] bg-white px-[34px] py-[30px] shadow-[0_8px_26px_#42505a26]">
        <div className="mb-4 grid size-12 place-items-center bg-[#1e465e] text-white">
          <Stethoscope size={28} />
        </div>
        <h1 className="m-0 text-[25px] font-bold">ClinSim CCS</h1>
        <p className="mb-7 mt-1 text-sm text-[#60717d]">
          Clinical case simulation training
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            mutation.mutate({
              email: String(data.get("email")),
              password: String(data.get("password")),
            });
          }}
        >
          <label className="mb-4 grid gap-1.5 text-[13px] font-bold">
            Email address
            <input
              className="h-[38px] border border-[#9eabb3] px-2.5"
              name="email"
              type="email"
              defaultValue={mode === "login" ? "student@example.com" : ""}
              required
            />
          </label>
          <label className="mb-4 grid gap-1.5 text-[13px] font-bold">
            Password
            <input
              className="h-[38px] border border-[#9eabb3] px-2.5"
              name="password"
              type="password"
              defaultValue={mode === "login" ? "password" : ""}
              minLength={8}
              required
            />
          </label>
          {mutation.error && (
            <p className="mb-3 text-xs text-red-700">
              {mutation.error.message}
            </p>
          )}
          <button
            className="h-10 w-full border border-[#153548] bg-[#1e465e] font-bold text-white disabled:opacity-50"
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>
        <button
          className="mt-3 w-full bg-transparent text-sm text-[#2c627f]"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Create student account" : "Back to sign in"}
        </button>
        <p className="mt-7 text-center text-[10px] text-[#71808a]">
          Independent educational software. Not affiliated with USMLE or NBME.
        </p>
      </section>
    </main>
  );
}

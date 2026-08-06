"use client";

import { ACADEMIC_NOTICE, APP_NAME, APP_SUBTITLE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { ThemeSelector } from "@/components/ThemeSelector";
import { Scale } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export function LoginForm() {
  const params = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    params.get("error") === "profile"
      ? "Your profile could not be loaded. Try signing in again with a demo account, or sign up for a new Client account."
      : params.get("error") === "auth"
        ? "Authentication could not be completed. Please try again."
        : null
  );
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (mode === "signup" && !fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      if (mode === "login") {
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
        if (signInError) {
          setError(signInError.message);
          setLoading(false);
          return;
        }

        if (signInData.user) {
          const { error: profileError } = await supabase.from("profiles").upsert(
            {
              id: signInData.user.id,
              full_name:
                fullName.trim() ||
                signInData.user.user_metadata?.full_name ||
                email.trim().split("@")[0],
              email: email.trim(),
              role: "client",
              job_title: "Client Portal User",
              active_status: true,
            },
            {
              onConflict: "id",
              ignoreDuplicates: true,
            }
          );
          if (profileError) {
            console.error(profileError);
          }
        }

        window.location.href = "/dashboard";
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      });
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (data.session && data.user) {
        await supabase.from("profiles").upsert(
          {
            id: data.user.id,
            full_name: fullName.trim() || email.trim().split("@")[0],
            email: email.trim(),
            role: "client",
            job_title: "Client Portal User",
            active_status: true,
          },
          { onConflict: "id", ignoreDuplicates: true }
        );
        window.location.href = "/dashboard";
        return;
      }

      setMessage(
        "Account created. If email confirmation is enabled, check your inbox. New public accounts receive the Client role."
      );
      setMode("login");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-base-200">
      <section className="login-brand-panel relative hidden lg:flex lg:w-[44%] xl:w-[46%] flex-col justify-between p-10 xl:p-14">
        <div>
          <div className="inline-flex items-center gap-3">
            <span className="btn btn-square bg-white/10 border-white/15 text-white pointer-events-none shadow-none app-brand-mark">
              <Scale className="h-5 w-5" />
            </span>
            <span className="font-display text-xl tracking-tight">{APP_NAME}</span>
          </div>
          <h1 className="font-display text-3xl xl:text-4xl leading-tight mt-10 max-w-md">
            Engagement control from first agreement to matter oversight
          </h1>
          <div className="login-accent-line" aria-hidden />
          <p className="mt-5 text-base text-white/75 max-w-md leading-relaxed">
            A professional workspace for client intake, engagement terms, staffing,
            tasks, and billing readiness—built for classroom demonstrations with
            fictional data only.
          </p>
        </div>
        <ul className="space-y-3 text-sm text-white/70">
          <li className="flex gap-2">
            <span className="text-accent mt-0.5" aria-hidden>
              —
            </span>
            Role-based access for partners, attorneys, staff, and clients
          </li>
          <li className="flex gap-2">
            <span className="text-accent mt-0.5" aria-hidden>
              —
            </span>
            Matter approval controls before work is activated
          </li>
          <li className="flex gap-2">
            <span className="text-accent mt-0.5" aria-hidden>
              —
            </span>
            Structured engagement and billing-readiness fields
          </li>
        </ul>
      </section>

      <div className="flex-1 flex flex-col min-h-screen">
        <div className="flex justify-end p-4">
          <ThemeSelector compact />
        </div>

        <div className="flex-1 flex items-center justify-center px-4 pb-10">
          <div className="w-full max-w-md">
            <div className="lg:hidden flex items-center gap-2 mb-6">
              <span className="btn btn-primary btn-square btn-sm shadow-none app-brand-mark">
                <Scale className="h-4 w-4" />
              </span>
              <span className="font-display text-xl tracking-tight">{APP_NAME}</span>
            </div>

            <div className="rounded-lg border border-base-content/10 bg-base-100 p-6 sm:p-8 shadow-sm">
              <h2 className="font-display text-2xl tracking-tight">
                {mode === "login" ? "Sign in" : "Create account"}
              </h2>
              <p className="text-sm text-base-content/60 mt-1">{APP_SUBTITLE}</p>

              <form className="mt-6 space-y-4" onSubmit={onSubmit}>
                {mode === "signup" && (
                  <div className="form-grid">
                    <label className="label-cell" htmlFor="fullName">
                      Full name
                    </label>
                    <div className="field-cell">
                      <input
                        id="fullName"
                        className="input input-bordered w-full"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        autoComplete="name"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="form-grid">
                  <label className="label-cell" htmlFor="email">
                    Email
                  </label>
                  <div className="field-cell">
                    <input
                      id="email"
                      type="email"
                      className="input input-bordered w-full"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="form-grid">
                  <label className="label-cell" htmlFor="password">
                    Password
                  </label>
                  <div className="field-cell">
                    <input
                      id="password"
                      type="password"
                      className="input input-bordered w-full"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      required
                      minLength={8}
                    />
                  </div>
                </div>

                {error && (
                  <div className="alert alert-error text-sm">
                    <span>{error}</span>
                  </div>
                )}
                {message && (
                  <div className="alert alert-success text-sm">
                    <span>{message}</span>
                  </div>
                )}

                <button className="btn btn-primary w-full" disabled={loading} type="submit">
                  {loading
                    ? "Please wait..."
                    : mode === "login"
                      ? "Log in"
                      : "Sign up as client"}
                </button>
              </form>

              <div className="divider text-xs my-5">or</div>

              <button
                type="button"
                className="btn btn-ghost btn-sm w-full"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setError(null);
                  setMessage(null);
                }}
              >
                {mode === "login"
                  ? "Need an account? Sign up"
                  : "Already registered? Log in"}
              </button>

              <p className="text-xs text-base-content/55 mt-4 leading-relaxed">
                Public signups receive the <strong>Client</strong> role only. Staff roles
                are assigned through seed accounts or partner control—not self-selected.
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-base-content/50 pb-6 px-4">
          {ACADEMIC_NOTICE}
        </p>
      </div>
    </div>
  );
}

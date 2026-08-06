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
    <div className="min-h-screen app-canvas flex flex-col">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/12 via-transparent to-accent/10" />
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
      </div>

      <div className="relative z-10 flex justify-end p-4">
        <ThemeSelector compact />
      </div>

      <div className="relative z-10 flex-1 flex items-center justify-center px-4 pb-10">
        <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center">
          <section className="hidden lg:block text-base-content px-4">
            <div className="inline-flex items-center gap-2 mb-6">
              <span className="btn btn-primary btn-square app-brand-mark">
                <Scale className="h-5 w-5" />
              </span>
              <span className="font-display text-2xl font-bold">{APP_NAME}</span>
            </div>
            <h1 className="font-display text-4xl font-bold leading-tight page-title-rule">
              Engagement control from first agreement to matter oversight
            </h1>
            <p className="mt-4 text-lg opacity-80 max-w-md">
              A professional workspace for client intake, engagement terms, staffing,
              tasks, and billing readiness—built for classroom demonstrations with
              fictional data only.
            </p>
            <ul className="mt-8 space-y-3 text-sm opacity-80">
              <li>• Role-based access for partners, attorneys, staff, and clients</li>
              <li>• Matter approval controls before work is activated</li>
              <li>• Structured engagement and billing-readiness fields</li>
            </ul>
          </section>

          <div className="card bg-base-100 shadow-xl border border-base-300">
            <div className="card-body">
              <div className="lg:hidden flex items-center gap-2 mb-2">
                <span className="btn btn-primary btn-square btn-sm">
                  <Scale className="h-4 w-4" />
                </span>
                <span className="font-display text-xl font-bold">{APP_NAME}</span>
              </div>
              <h2 className="card-title font-display text-2xl">
                {mode === "login" ? "Sign in" : "Create account"}
              </h2>
              <p className="text-sm opacity-70">{APP_SUBTITLE}</p>

              <form className="mt-4 space-y-4" onSubmit={onSubmit}>
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

              <div className="divider text-xs">or</div>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
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

              <p className="text-xs opacity-60 mt-2">
                Public signups receive the <strong>Client</strong> role only. Staff roles
                are assigned through seed accounts or partner control—not self-selected.
              </p>
            </div>
          </div>
        </div>
      </div>

      <p className="relative z-10 text-center text-xs opacity-60 pb-6 px-4">
        {ACADEMIC_NOTICE}
      </p>
    </div>
  );
}

import { isDemoMode } from "@/lib/demo-config";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  if (isDemoMode()) {
    redirect("/demo-enter");
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

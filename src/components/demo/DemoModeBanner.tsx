"use client";

import { DEMO_BANNER_DISMISS_KEY } from "@/lib/demo-config";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

export function DemoModeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DEMO_BANNER_DISMISS_KEY) !== "1") {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function dismiss() {
    try {
      localStorage.setItem(DEMO_BANNER_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  return (
    <div className="alert alert-info py-2 px-3 mb-4 text-sm shadow-sm">
      <div className="flex-1">
        <p>
          You are viewing Rebel Law Group in Demo Mode. Use the{" "}
          <strong>View App As</strong> menu to preview each role&apos;s workspace. All
          information is fictional.
        </p>
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-xs btn-square"
        onClick={dismiss}
        aria-label="Dismiss demo banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

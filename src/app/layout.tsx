import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Rebel Law Group",
  description:
    "Fictional academic project for legal engagement and matter management.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="rebel-navy"
      className={`${manrope.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full antialiased">
        {/* Applies the stored theme before first paint. Keep in sync with
            THEME_STORAGE_KEY / LIGHT_THEME / DARK_THEME / FUN_THEME. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("rlg-theme");var ok=["rebel-navy","rebel-night","rebel-fun"];document.documentElement.setAttribute("data-theme",ok.indexOf(t)>=0?t:(t==="business"?"rebel-night":"rebel-navy"))}catch(e){}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}

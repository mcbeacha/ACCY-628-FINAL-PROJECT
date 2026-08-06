import type { Metadata } from "next";
import { Cormorant_Garamond, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
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
      className={`${sourceSans.variable} ${cormorant.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full antialiased">
        {/* Applies the stored theme before first paint. Keep the key and values
            in sync with THEME_STORAGE_KEY / LIGHT_THEME / DARK_THEME. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("rlg-theme");document.documentElement.setAttribute("data-theme",t==="rebel-night"||t==="business"?"rebel-night":"rebel-navy")}catch(e){}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}

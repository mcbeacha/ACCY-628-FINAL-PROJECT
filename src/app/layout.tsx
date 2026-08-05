import type { Metadata } from "next";
import { Libre_Baskerville, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

const libre = Libre_Baskerville({
  variable: "--font-libre",
  weight: ["400", "700"],
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
      data-theme="corporate"
      className={`${sourceSans.variable} ${libre.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full antialiased">
        {/* Applies the stored theme before first paint. Keep the key and values
            in sync with THEME_STORAGE_KEY / LIGHT_THEME / DARK_THEME. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("rlg-theme");document.documentElement.setAttribute("data-theme",t==="business"?"business":"corporate")}catch(e){}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}

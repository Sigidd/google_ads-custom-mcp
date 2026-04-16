/**
 * /connect — Google Ads connection page.
 *
 * Reached after the MCP client initiates the OAuth 2.1 flow.
 * The user clicks "Connect with Google Ads" to start the Google OAuth flow.
 * No manual credential entry is required.
 *
 * This is a server component — validates session_id and passes it to the
 * client component ConnectForm.
 */
import { Suspense } from "react";
import ConnectForm from "./ConnectForm";

export default function ConnectPage() {
  return (
    <main style={styles.main}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.png"
            alt="Google Ads MCP"
            width={48}
            height={48}
            style={{ borderRadius: 10 }}
          />
        </div>

        <h1 style={styles.title}>Connect Google Ads</h1>
        <p style={styles.subtitle}>
          Sign in with your Google account to connect Claude to Google Ads.
          You will be asked to grant access to manage your Google Ads campaigns.
        </p>

        <Suspense fallback={null}>
          <ConnectForm />
        </Suspense>

        <div style={styles.hint}>
          <p style={{ margin: "0 0 0.4rem", fontWeight: 600, color: "#555" }}>
            What access is requested?
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.6 }}>
            <li>
              <strong>Google Ads API</strong> — read and manage campaigns, ad
              groups, keywords, budgets, and reports
            </li>
            <li>
              <strong>Email address</strong> — used to identify your account
            </li>
          </ul>
          <p
            style={{
              margin: "0.6rem 0 0",
              fontSize: "0.78rem",
              color: "#888",
            }}
          >
            Your credentials are stored securely. Tokens are auto-refreshed —
            you only need to connect once.
          </p>
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f0f0f5",
    fontFamily: "system-ui, sans-serif",
    padding: "1rem",
  },
  card: {
    background: "#fff",
    borderRadius: "14px",
    padding: "2.5rem",
    maxWidth: "460px",
    width: "100%",
    boxShadow: "0 4px 28px rgba(0,0,0,0.10)",
  },
  logoWrap: {
    marginBottom: "1.25rem",
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: 700,
    margin: "0 0 0.5rem",
    color: "#111",
  },
  subtitle: {
    fontSize: "0.9rem",
    color: "#555",
    marginBottom: "1.75rem",
    lineHeight: 1.55,
  },
  hint: {
    marginTop: "1.75rem",
    fontSize: "0.8rem",
    color: "#777",
    lineHeight: 1.5,
    background: "#f8f8fc",
    borderRadius: 8,
    padding: "1rem 1.1rem",
    border: "1px solid #e5e5f0",
  },
};

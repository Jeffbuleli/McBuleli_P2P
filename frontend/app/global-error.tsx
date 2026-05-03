"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, background: "#0a0a0b", color: "#e4e4e7", fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "1.5rem",
            textAlign: "center",
          }}
        >
          <h2 style={{ color: "#fff", fontSize: "1.125rem", fontWeight: 600 }}>Erreur critique</h2>
          <p style={{ maxWidth: "28rem", fontSize: "0.875rem", opacity: 0.85 }}>{error.message}</p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              borderRadius: "0.75rem",
              background: "#10b981",
              color: "#fff",
              padding: "0.5rem 1.25rem",
              fontSize: "0.875rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}

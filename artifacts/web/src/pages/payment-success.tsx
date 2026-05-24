export default function PaymentSuccessPage() {
  return (
    <main
      style={{
        maxWidth: "480px",
        margin: "4rem auto",
        padding: "1.5rem",
        fontFamily: "system-ui, -apple-system, sans-serif",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        Payment Successful
      </h1>
      <p style={{ color: "#555", fontSize: "0.9rem" }}>
        Your credits have been added to your account.
      </p>
      <a
        href="/"
        style={{
          display: "inline-block",
          marginTop: "1.5rem",
          padding: "0.75rem 1.5rem",
          background: "#7c3aed",
          color: "#fff",
          borderRadius: "8px",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        Go Home
      </a>
    </main>
  );
}

import React from "react";

export default function Terms() {
  return (
    <div className="container py-4" style={{ maxWidth: 800, margin: "0 auto" }}>
      <h2>Terms of Service</h2>
      <p className="text-muted">Last updated: {new Date().toISOString().slice(0, 10)}</p>

      <p>
        These Terms of Service ("Terms") govern your use of this application.
        By accessing or using the app, you agree to be bound by these Terms.
        If you do not agree, do not use the app.
      </p>

      <h4>Use of the Service</h4>
      <p>
        You may use the app only for lawful purposes and in accordance with
        these Terms. You are responsible for your account and for any activity
        that occurs under your account.
      </p>

      <h4>Data and Content</h4>
      <p>
        You are responsible for the data you enter into the app. Do not store
        sensitive or confidential information. We may process and store your
        data to provide features of the app.
      </p>

      <h4>Disclaimer</h4>
      <p>
        The app is provided on an "AS IS" and "AS AVAILABLE" basis without
        warranties of any kind, express or implied. We do not warrant that the
        app will be uninterrupted, secure, or error‑free.
      </p>

      <h4>Limitation of Liability</h4>
      <p>
        To the maximum extent permitted by law, in no event shall we be liable
        for any indirect, incidental, special, consequential, or punitive damages,
        or any loss of data, revenue, profits, or goodwill, arising out of or
        related to your use of the app.
      </p>

      <h4>Termination</h4>
      <p>
        We may suspend or terminate access to the app at any time for any
        reason, including if you breach these Terms.
      </p>

      <h4>Changes</h4>
      <p>
        We may update these Terms from time to time. Continued use of the app
        after changes indicates acceptance of the updated Terms.
      </p>

      <h4>Contact</h4>
      <p>
        If you have questions about these Terms, contact the app owner.
      </p>
    </div>
  );
}


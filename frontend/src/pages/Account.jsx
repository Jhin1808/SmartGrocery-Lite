import React from "react";
import { Card } from "react-bootstrap";

export default function Account() {
  // Later: pull current user from API; allow change password
  const email = "(your-email@domain.com)";
  return (
    <Card>
      <Card.Body>
        <h4 className="mb-3">Account</h4>
        <div className="text-muted">Signed in as {email}</div>
        <hr />
        <p className="mb-0">Password change coming soon.</p>
      </Card.Body>
    </Card>
  );
}

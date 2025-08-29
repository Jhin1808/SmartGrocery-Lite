import { useEffect, useMemo, useState, useRef } from "react";
import {
  Card, Form, Button, Row, Col, InputGroup,
  Tabs, Tab, Toast, ToastContainer
} from "react-bootstrap";
import { useAuth } from "../pages/AuthContext";
import { apiUpdateMe } from "../api";
import { apiChangePassword } from "../api";
export default function Account() {
  const { user, refresh } = useAuth(); // user: { id, email, name, picture }
  // ------- Profile state -------
  const [name, setName] = useState("");
  const [picture, setPicture] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  

  // robust preview (avoid infinite onError loops)
  const [previewSrc, setPreviewSrc] = useState("");
  const hadErrorRef = useRef(false);

  useEffect(() => {
    setName(user?.name || "");
    setPicture(user?.picture || "");
    hadErrorRef.current = false;
  }, [user]);

  const fallbackAvatar = useMemo(() => {
    const label = user?.name || user?.email || "User";
    return `https://ui-avatars.com/api/?background=random&name=${encodeURIComponent(label)}`;
  }, [user]);

  const sanitizeImageUrl = (u) => {
    if (!u) return "";
    const s = String(u).trim();
    if (!s || s.startsWith("<")) return ""; // avoid accidental HTML
    // Allow safe data URLs for raster images only
    if (s.startsWith("data:")) {
      const head = s.slice(5, 40).toLowerCase();
      const ok = [
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
      ].some((t) => head.startsWith(t));
      return ok ? s : ""; // disallow SVG and others
    }
    try {
      const url = new URL(s, window.location.origin);
      const proto = url.protocol.replace(":", "");
      if (["http", "https", "blob"].includes(proto)) return url.href;
    } catch {}
    return "";
  };

  useEffect(() => {
    const safe = sanitizeImageUrl(picture);
    setPreviewSrc(safe || fallbackAvatar);
  }, [picture, fallbackAvatar]);

  const onImgError = () => {
    // only swap to fallback once; prevents error loop if fallback also fails
    if (!hadErrorRef.current) {
      hadErrorRef.current = true;
      setPreviewSrc(fallbackAvatar);
    }
  };

  const dirtyProfile =
    name !== (user?.name || "") || picture !== (user?.picture || "");

  const clearPicture = () => setPicture("");

  // Toasts
  const [toast, setToast] = useState(null);
  const showToast = (variant, msg) => setToast({ variant, msg });

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!dirtyProfile) return;
    setSavingProfile(true);
    try {
      // Backend converts "" -> null via validator; this clears the avatar
      await apiUpdateMe({ name, picture });
      await refresh();
      showToast("success", "Profile updated");
    } catch (err) {
      showToast("danger", err.message || "Update failed");
    } finally {
      setSavingProfile(false);
    }
  };

  // ------- Security (change password) -------
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  const canSavePwd =
    newPwd.length >= 8 && newPwd === confirmPwd; // simple UX check

  const savePassword = async (e) => {
    e.preventDefault();
    if (!canSavePwd) return;
    setSavingPwd(true);
    try {
      // If the user never had a password (SSO-only), backend allows current_password = null/""
      await apiChangePassword({
        current_password: currentPwd || null,
        new_password: newPwd,
      });
      // Clean fields
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
      showToast("success", "Password updated");
    } catch (err) {
      showToast("danger", err.message || "Password update failed");
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <>
      <Card>
        <Card.Body>
          <h4 className="mb-3">Account</h4>

          <Row className="align-items-center g-3">
            <Col xs="auto">
              <img
                src={previewSrc}
                onError={onImgError}
                width={96}
                height={96}
                alt="avatar"
                className="rounded-circle border"
                style={{ objectFit: "cover" }}
              />
            </Col>
            <Col>
              <div className="text-muted">Signed in as</div>
              <div className="fw-semibold">{user?.email}</div>
            </Col>
          </Row>

          <hr />

          <Tabs defaultActiveKey="profile" className="mb-3">
            {/* -------- Profile tab -------- */}
            <Tab eventKey="profile" title="Profile">
              <Form onSubmit={saveProfile}>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group controlId="accName">
                      <Form.Label>Name</Form.Label>
                      <Form.Control
                        placeholder="Your display name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={120}
                      />
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group controlId="accPicture">
                      <Form.Label>Profile image URL</Form.Label>
                      <InputGroup>
                        <Form.Control
                          placeholder="https://example.com/photo.jpg"
                          value={picture}
                          onChange={(e) => setPicture(e.target.value)}
                        />
                        <Button
                          variant="outline-secondary"
                          type="button"
                          onClick={clearPicture}
                          title="Clear image"
                        >
                          Clear
                        </Button>
                      </InputGroup>
                      <Form.Text className="text-muted">
                        Leave blank and save to remove your picture.
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>

                <div className="mt-3 d-flex gap-2">
                  <Button
                    type="submit"
                    disabled={!dirtyProfile || savingProfile}
                  >
                    {savingProfile ? "Saving…" : "Save changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline-secondary"
                    disabled={!dirtyProfile || savingProfile}
                    onClick={() => {
                      setName(user?.name || "");
                      setPicture(user?.picture || "");
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </Form>
            </Tab>

            {/* -------- Security tab -------- */}
            <Tab eventKey="security" title="Security">
              <Form onSubmit={savePassword}>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group controlId="curPwd">
                      <Form.Label>Current password</Form.Label>
                      <Form.Control
                        type="password"
                        placeholder="(leave empty if you never set one)"
                        value={currentPwd}
                        onChange={(e) => setCurrentPwd(e.target.value)}
                        autoComplete="current-password"
                      />
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group controlId="newPwd">
                      <Form.Label>New password</Form.Label>
                      <Form.Control
                        type="password"
                        placeholder="At least 8 characters"
                        value={newPwd}
                        onChange={(e) => setNewPwd(e.target.value)}
                        autoComplete="new-password"
                        minLength={8}
                        required
                      />
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group controlId="confirmPwd">
                      <Form.Label>Confirm new password</Form.Label>
                      <Form.Control
                        type="password"
                        placeholder="Repeat new password"
                        value={confirmPwd}
                        onChange={(e) => setConfirmPwd(e.target.value)}
                        autoComplete="new-password"
                        isInvalid={
                          confirmPwd.length > 0 && confirmPwd !== newPwd
                        }
                      />
                      <Form.Control.Feedback type="invalid">
                        Passwords don’t match.
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>

                <div className="mt-3">
                  <Button type="submit" disabled={!canSavePwd || savingPwd}>
                    {savingPwd ? "Updating…" : "Update password"}
                  </Button>
                </div>

                <div className="text-muted small mt-3">
                  If you signed in with Google and never set a password, you can
                  leave “Current password” empty to create one now.
                </div>
              </Form>
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>

      <ToastContainer position="top-end" className="p-3">
        {toast && (
          <Toast
            bg={toast.variant}
            onClose={() => setToast(null)}
            show
            delay={1800}
            autohide
          >
            <Toast.Body
              className={toast.variant === "danger" ? "" : "text-white"}
            >
              {toast.msg}
            </Toast.Body>
          </Toast>
        )}
      </ToastContainer>
    </>
  );
}

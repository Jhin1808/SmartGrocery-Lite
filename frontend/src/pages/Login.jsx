import { useEffect, useRef, useState } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  InputGroup,
  Alert,
  Spinner,
  Tabs,
  Tab,
} from "react-bootstrap";
import { apiLogin, apiRegister } from "../api";

// If you have an API base, you can use it to kick off SSO redirects:
const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

export default function Auth({ onLoggedIn }) {
  // ---- shared UI ----
  const [tab, setTab] = useState("login");
  const [err, setErr] = useState(null);
  const [toastMsg, setToastMsg] = useState(null); // simple success note

  // ---- login state ----
  const [email, setEmail] = useState("account@example.com");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busyLogin, setBusyLogin] = useState(false);
  const emailRef = useRef(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const canSubmitLogin =
    email.trim().length > 3 &&
    email.includes("@") &&
    password.trim().length >= 6;

  const submitLogin = async (e) => {
    e.preventDefault();
    if (!canSubmitLogin) return;
    setErr(null);
    setBusyLogin(true);
    try {
      const tok = await apiLogin(email.trim(), password);
      const val = tok?.access_token || tok?.token || tok;
      if (remember && val) localStorage.setItem("token", val);
      onLoggedIn(tok);
    } catch (ex) {
      setErr(ex.message || "Login failed");
    } finally {
      setBusyLogin(false);
    }
  };

  // ---- register state ----
  const [rEmail, setREmail] = useState("");
  const [rPassword, setRPassword] = useState("");
  const [rConfirm, setRConfirm] = useState("");
  const [busyReg, setBusyReg] = useState(false);
  const canSubmitReg =
    rEmail.trim().includes("@") &&
    rPassword.length >= 6 &&
    rPassword === rConfirm;

  const submitRegister = async (e) => {
    e.preventDefault();
    if (!canSubmitReg) return;
    setErr(null);
    setBusyReg(true);
    try {
      await apiRegister({ email: rEmail.trim(), password: rPassword });
      setToastMsg("Account created! You can log in now.");
      setTab("login");
      setEmail(rEmail.trim());
      setPassword("");
      setREmail("");
      setRPassword("");
      setRConfirm("");
    } catch (ex) {
      setErr(ex.message || "Registration failed");
    } finally {
      setBusyReg(false);
    }
  };

  // ---- SSO buttons (wire these to your backend OAuth routes later) ----
  const loginWithGoogle = () => {
    // Recommended to use Google’s official rendered button or follow guidelines if custom. :contentReference[oaicite:2]{index=2}
    window.location.href = `${API_BASE}/auth/google/login`;
  };
  const loginWithGitHub = () => {
    // GitHub’s OAuth flow; you can start it server-side then redirect here. :contentReference[oaicite:3]{index=3}
    window.location.href = `${API_BASE}/auth/github/login`;
  };

  return (
    <Container className="min-vh-100 d-flex align-items-center">
      <Row className="w-100 justify-content-center">
        <Col xs={12} sm={10} md={8} lg={6} xl={5}>
          <Card className="shadow-sm">
            <Card.Body className="p-4">
              <div className="text-center mb-3">
                <h3 className="mb-1">SmartGrocery Lite</h3>
                <div className="text-muted">Welcome back</div>
              </div>

              {err && (
                <Alert
                  variant="danger"
                  dismissible
                  onClose={() => setErr(null)}
                >
                  {err}
                </Alert>
              )}
              {toastMsg && (
                <Alert
                  variant="success"
                  dismissible
                  onClose={() => setToastMsg(null)}
                >
                  {toastMsg}
                </Alert>
              )}

              <Tabs
                id="auth-tabs"
                className="mb-3 justify-content-center"
                activeKey={tab}
                onSelect={(k) => setTab(k || "login")}
                mountOnEnter
                unmountOnExit
              >
                {/* ---------------- Login tab ---------------- */}
                <Tab eventKey="login" title="Login">
                  <Form onSubmit={submitLogin}>
                    <Form.Group className="mb-3" controlId="loginEmail">
                      <Form.Label>Email</Form.Label>
                      <Form.Control
                        ref={emailRef}
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="username"
                        required
                      />
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="loginPassword">
                      <Form.Label>Password</Form.Label>
                      <InputGroup>
                        <Form.Control
                          type={showPw ? "text" : "password"}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete="current-password"
                          required
                          minLength={6}
                        />
                        <Button
                          variant="outline-secondary"
                          type="button"
                          onClick={() => setShowPw((s) => !s)}
                          title={showPw ? "Hide password" : "Show password"}
                        >
                          <i
                            className={showPw ? "bi bi-eye-slash" : "bi bi-eye"}
                          />
                        </Button>
                      </InputGroup>
                    </Form.Group>

                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <Form.Check
                        id="remember"
                        type="checkbox"
                        label="Remember me"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                      />
                      <a href="#" className="small text-decoration-none">
                        Forgot password?
                      </a>
                    </div>

                    <div className="d-grid gap-2">
                      <Button
                        type="submit"
                        disabled={busyLogin || !canSubmitLogin}
                      >
                        {busyLogin ? (
                          <>
                            <Spinner
                              as="span"
                              size="sm"
                              animation="border"
                              className="me-2"
                            />
                            Signing in…
                          </>
                        ) : (
                          "Sign in"
                        )}
                      </Button>
                      <div className="text-center text-muted">or</div>
                      <Button
                        variant="outline-dark"
                        type="button"
                        onClick={loginWithGoogle}
                        className="d-flex align-items-center justify-content-center gap-2"
                        title="Sign in with Google"
                      >
                        <i className="bi bi-google" aria-hidden="true" />
                        <span>Sign in with Google</span>
                      </Button>
                      <Button
                        variant="outline-dark"
                        type="button"
                        onClick={loginWithGitHub}
                        className="d-flex align-items-center justify-content-center gap-2"
                        title="Sign in with GitHub"
                      >
                        <i className="bi bi-github" aria-hidden="true" />
                        <span>Sign in with GitHub</span>
                      </Button>
                    </div>
                  </Form>
                </Tab>

                {/* ---------------- Register tab ---------------- */}
                <Tab eventKey="signup" title="Sign up">
                  <Form onSubmit={submitRegister}>
                    <Form.Group className="mb-3" controlId="regEmail">
                      <Form.Label>Email</Form.Label>
                      <Form.Control
                        type="email"
                        placeholder="you@example.com"
                        value={rEmail}
                        onChange={(e) => setREmail(e.target.value)}
                        autoComplete="username"
                        required
                      />
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="regPassword">
                      <Form.Label>Password</Form.Label>
                      <Form.Control
                        type="password"
                        placeholder="At least 6 characters"
                        value={rPassword}
                        onChange={(e) => setRPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                        minLength={6}
                      />
                    </Form.Group>

                    <Form.Group className="mb-4" controlId="regConfirm">
                      <Form.Label>Confirm password</Form.Label>
                      <Form.Control
                        type="password"
                        placeholder="Repeat your password"
                        value={rConfirm}
                        onChange={(e) => setRConfirm(e.target.value)}
                        autoComplete="new-password"
                        required
                        minLength={6}
                        isInvalid={
                          rConfirm.length > 0 && rConfirm !== rPassword
                        }
                      />
                      <Form.Control.Feedback type="invalid">
                        Passwords don’t match.
                      </Form.Control.Feedback>
                    </Form.Group>

                    <div className="d-grid">
                      <Button type="submit" disabled={busyReg || !canSubmitReg}>
                        {busyReg ? (
                          <>
                            <Spinner
                              as="span"
                              size="sm"
                              animation="border"
                              className="me-2"
                            />
                            Creating account…
                          </>
                        ) : (
                          "Create account"
                        )}
                      </Button>
                    </div>
                  </Form>
                </Tab>
              </Tabs>

              <div className="text-center mt-3">
                <span className="text-muted">
                  {tab === "login" ? "No account?" : "Already have an account?"}
                </span>{" "}
                <button
                  className="btn btn-link p-0 align-baseline"
                  onClick={() => setTab(tab === "login" ? "signup" : "login")}
                >
                  {tab === "login" ? "Sign up" : "Sign in"}
                </button>
              </div>
            </Card.Body>
          </Card>

          <div className="text-center text-muted small mt-3">
            © {new Date().getFullYear()} SmartGrocery Lite
          </div>
        </Col>
      </Row>
    </Container>
  );
}

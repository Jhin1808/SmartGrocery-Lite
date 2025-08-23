// src/components/NavBar.jsx
import { Navbar, Container, Nav, NavDropdown, Button } from "react-bootstrap";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../pages/AuthContext";
import { apiLogout } from "../api";  // remove unused API_BASE

export default function NavBar() {
  const { user, loading, refresh } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Hide the navbar on auth pages
  const hideOnRoutes = ["/login", "/oauth/callback"];
  if (hideOnRoutes.some(p => location.pathname.startsWith(p))) {
    return null;
  }

  const onLogout = async () => {
    try {
      await apiLogout();   // clears cookie
      await refresh();     // sets user = null in context
      navigate("/login", { replace: true });
    } catch {
      // even if it fails, send them to login
      navigate("/login", { replace: true });
    }
  };

  return (
    <Navbar bg="light" expand="md" className="shadow-sm">
      <Container>
        <Navbar.Brand as={NavLink} to="/lists">SmartGrocery Lite</Navbar.Brand>
        <Navbar.Toggle aria-controls="main-nav" />
        <Navbar.Collapse id="main-nav">
          {!!user && (
            <Nav className="me-auto">
              <Nav.Link as={NavLink} to="/lists">Lists</Nav.Link>
              <Nav.Link as={NavLink} to="/account">Account</Nav.Link>
              <Nav.Link as={NavLink} to="/help">Help</Nav.Link>
            </Nav>
          )}

          <Nav className="ms-auto">
            {loading ? (
              <Navbar.Text className="text-muted">Loading…</Navbar.Text>
            ) : user ? (
              <NavDropdown
                align="end"
                title={user.name || user.email || "Account"}
                id="user-menu"
              >
                <NavDropdown.Item as={NavLink} to="/account">Profile</NavDropdown.Item>
                <NavDropdown.Divider />
                <NavDropdown.Item onClick={onLogout}>Sign out</NavDropdown.Item>
              </NavDropdown>
            ) : (
              // In case someone navigates directly to a non-auth page without being logged in
              <Button variant="outline-primary" onClick={() => navigate("/login")}>
                Sign in
              </Button>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

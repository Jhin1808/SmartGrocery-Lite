// src/components/NavBar.jsx
import React from "react";
import { Navbar, Nav, Container, NavDropdown } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { useNavigate } from "react-router-dom";

export default function NavBar() {
  const navigate = useNavigate();
  const authed = !!localStorage.getItem("token");

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  };

  return (
    <Navbar bg="dark" variant="dark" expand="md">
      <Container>
        <LinkContainer to={authed ? "/lists" : "/login"}>
          <Navbar.Brand>SmartGrocery Lite</Navbar.Brand>
        </LinkContainer>

        <Navbar.Toggle aria-controls="main-nav" />
        <Navbar.Collapse id="main-nav">
          <Nav className="me-auto">
            {authed && (
              <>
                <LinkContainer to="/lists">
                  <Nav.Link>My Lists</Nav.Link>
                </LinkContainer>
                {/* Optional: a link to a demo list detail route */}
                {/* <LinkContainer to="/lists/1"><Nav.Link>Demo List</Nav.Link></LinkContainer> */}
                <LinkContainer to="/help">
                  <Nav.Link>Help</Nav.Link>
                </LinkContainer>
              </>
            )}
          </Nav>

          <Nav className="ms-auto">
            {!authed ? (
              <LinkContainer to="/login">
                <Nav.Link>Login</Nav.Link>
              </LinkContainer>
            ) : (
              <NavDropdown title="Account" align="end">
                <LinkContainer to="/account">
                  <NavDropdown.Item>Profile</NavDropdown.Item>
                </LinkContainer>
                <NavDropdown.Divider />
                <NavDropdown.Item onClick={logout}>Logout</NavDropdown.Item>
              </NavDropdown>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

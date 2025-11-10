import { useState, useEffect } from "react";
import { Form, Button, Container, Row, Col, Card, Alert, Spinner } from "react-bootstrap";
import { useAuth } from "./AuthContext";
import "./enhanced-styles.css"; // Import the enhanced CSS

export default function EnhancedAuthTabs() {
  const { login, register, user } = useAuth();
  const [activeTab, setActiveTab] = useState("login");
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  
  // Register form state
  const [registerFirstName, setRegisterFirstName] = useState("");
  const [registerLastName, setRegisterLastName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [subscribeNewsletter, setSubscribeNewsletter] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Animation states
  const [isLoading, setIsLoading] = useState(false);

  // Password strength checker
  useEffect(() => {
    if (registerPassword) {
      let strength = 0;
      if (registerPassword.length >= 8) strength++;
      if (registerPassword.match(/[a-z]/) && registerPassword.match(/[A-Z]/)) strength++;
      if (registerPassword.match(/[0-9]/)) strength++;
      if (registerPassword.match(/[^a-zA-Z0-9]/)) strength++;
      setPasswordStrength(strength);
    } else {
      setPasswordStrength(0);
    }
  }, [registerPassword]);

  // Check if passwords match
  const passwordsMatch = registerPassword === confirmPassword && registerPassword.length > 0;

  // Handle login form submission
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock successful login
      const mockUser = {
        id: 1,
        email: loginEmail,
        name: "John Doe",
        token: "mock-jwt-token"
      };
      
      await login(mockUser);
      
      // Show success message and redirect
      setTimeout(() => {
        window.location.href = '/lists';
      }, 1000);
      
    } catch (error) {
      setLoginError(error.message || "Login failed. Please check your credentials.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle register form submission
  const handleRegister = async (e) => {
    e.preventDefault();
    setRegisterLoading(true);
    setRegisterError("");
    
    // Validation
    if (!agreeTerms) {
      setRegisterError("Please agree to the Terms of Service and Privacy Policy.");
      setRegisterLoading(false);
      return;
    }
    
    if (registerPassword !== confirmPassword) {
      setRegisterError("Passwords do not match.");
      setRegisterLoading(false);
      return;
    }
    
    if (registerPassword.length < 8) {
      setRegisterError("Password must be at least 8 characters long.");
      setRegisterLoading(false);
      return;
    }
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock successful registration
      const mockUser = {
        id: Date.now(),
        email: registerEmail,
        name: `${registerFirstName} ${registerLastName}`,
        token: "mock-jwt-token"
      };
      
      await register(mockUser);
      
      // Show success message and switch to login
      setTimeout(() => {
        setActiveTab("login");
        // Clear form
        setRegisterFirstName("");
        setRegisterLastName("");
        setRegisterEmail("");
        setRegisterPassword("");
        setConfirmPassword("");
        setAgreeTerms(false);
        setSubscribeNewsletter(false);
      }, 2000);
      
    } catch (error) {
      setRegisterError(error.message || "Registration failed. Please try again.");
    } finally {
      setRegisterLoading(false);
    }
  };

  // Social login handlers
  const handleSocialLogin = (provider) => {
    // Mock social login
    console.log(`Logging in with ${provider}`);
    // In a real app, this would redirect to OAuth flow
  };

  // Password strength indicator
  const getPasswordStrengthColor = () => {
    if (passwordStrength === 0) return "bg-secondary";
    if (passwordStrength <= 1) return "bg-danger";
    if (passwordStrength === 2) return "bg-warning";
    return "bg-success";
  };

  const getPasswordStrengthWidth = () => {
    return `${(passwordStrength / 4) * 100}%`;
  };

  return (
    <div className="min-vh-100 d-flex align-items-center py-5">
      <div className="organic-pattern"></div>
      
      <Container>
        <Row className="justify-content-center">
          <Col xs={12} lg={8} xl={6}>
            {/* Header */}
            <div className="text-center mb-5">
              <div className="d-flex align-items-center justify-content-center gap-3 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-leaf-green to-mint-light rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-2xl">🛒</span>
                </div>
                <h1 className="font-display text-4xl font-bold text-forest-dark mb-0">
                  SmartGrocery
                </h1>
              </div>
              <p className="text-xl text-text-secondary">
                {activeTab === "login" 
                  ? "Welcome back! Let's make shopping smarter." 
                  : "Join thousands making grocery shopping easier!"}
              </p>
            </div>

            {/* Auth Card */}
            <Card className="shadow-lg border-0">
              <Card.Body className="p-0">
                {/* Tab Navigation */}
                <div className="d-flex border-bottom bg-light">
                  <button
                    className={`flex-1 py-4 border-0 bg-transparent font-semibold text-lg transition-colors ${
                      activeTab === "login"
                        ? "text-forest-dark border-b-2 border-leaf-green"
                        : "text-text-secondary hover:text-forest-medium"
                    }`}
                    onClick={() => setActiveTab("login")}
                    disabled={loginLoading || registerLoading}
                  >
                    Sign In
                  </button>
                  <button
                    className={`flex-1 py-4 border-0 bg-transparent font-semibold text-lg transition-colors ${
                      activeTab === "register"
                        ? "text-forest-dark border-b-2 border-leaf-green"
                        : "text-text-secondary hover:text-forest-medium"
                    }`}
                    onClick={() => setActiveTab("register")}
                    disabled={loginLoading || registerLoading}
                  >
                    Create Account
                  </button>
                </div>

                {/* Login Form */}
                {activeTab === "login" && (
                  <div className="p-6">
                    {/* Social Login */}
                    <div className="mb-6">
                      <div className="d-grid gap-3">
                        <Button
                          variant="outline-secondary"
                          className="d-flex align-items-center justify-content-center gap-3 py-3"
                          onClick={() => handleSocialLogin("google")}
                          disabled={loginLoading}
                        >
                          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                          Continue with Google
                        </Button>
                        
                        <Button
                          variant="outline-secondary"
                          className="d-flex align-items-center justify-content-center gap-3 py-3"
                          onClick={() => handleSocialLogin("apple")}
                          disabled={loginLoading}
                        >
                          <span className="text-2xl">🍎</span>
                          Continue with Apple
                        </Button>
                      </div>

                      <div className="d-flex align-items-center gap-3 my-4">
                        <div className="flex-1 border-t border-gray-300"></div>
                        <span className="text-sm text-text-secondary">or continue with email</span>
                        <div className="flex-1 border-t border-gray-300"></div>
                      </div>
                    </div>

                    {/* Email Login Form */}
                    <Form onSubmit={handleLogin}>
                      <Form.Group className="mb-4">
                        <Form.Label className="text-forest-dark font-medium">Email Address</Form.Label>
                        <Form.Control
                          type="email"
                          placeholder="Enter your email"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          required
                          disabled={loginLoading}
                          className="border-0 bg-light"
                        />
                      </Form.Group>

                      <Form.Group className="mb-4">
                        <Form.Label className="text-forest-dark font-medium">Password</Form.Label>
                        <Form.Control
                          type="password"
                          placeholder="Enter your password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                          disabled={loginLoading}
                          className="border-0 bg-light"
                        />
                      </Form.Group>

                      <div className="d-flex justify-content-between align-items-center mb-6">
                        <Form.Check
                          type="checkbox"
                          id="remember-me"
                          label="Remember me"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          disabled={loginLoading}
                        />
                        <a href="#" className="text-forest-medium hover:text-leaf-green text-sm">
                          Forgot password?
                        </a>
                      </div>

                      {loginError && (
                        <Alert variant="danger" className="mb-4">
                          {loginError}
                        </Alert>
                      )}

                      <Button
                        type="submit"
                        className="w-100 py-3"
                        disabled={loginLoading || !loginEmail || !loginPassword}
                      >
                        {loginLoading ? (
                          <>
                            <Spinner size="sm" className="me-2" />
                            Signing in...
                          </>
                        ) : (
                          "Sign In"
                        )}
                      </Button>
                    </Form>
                  </div>
                )}

                {/* Register Form */}
                {activeTab === "register" && (
                  <div className="p-6">
                    {/* Social Register */}
                    <div className="mb-6">
                      <div className="d-grid gap-3">
                        <Button
                          variant="outline-secondary"
                          className="d-flex align-items-center justify-content-center gap-3 py-3"
                          onClick={() => handleSocialLogin("google")}
                          disabled={registerLoading}
                        >
                          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                          Continue with Google
                        </Button>
                        
                        <Button
                          variant="outline-secondary"
                          className="d-flex align-items-center justify-content-center gap-3 py-3"
                          onClick={() => handleSocialLogin("apple")}
                          disabled={registerLoading}
                        >
                          <span className="text-2xl">🍎</span>
                          Continue with Apple
                        </Button>
                      </div>

                      <div className="d-flex align-items-center gap-3 my-4">
                        <div className="flex-1 border-t border-gray-300"></div>
                        <span className="text-sm text-text-secondary">or sign up with email</span>
                        <div className="flex-1 border-t border-gray-300"></div>
                      </div>
                    </div>

                    {/* Email Register Form */}
                    <Form onSubmit={handleRegister}>
                      <Row className="mb-4">
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label className="text-forest-dark font-medium">First Name</Form.Label>
                            <Form.Control
                              type="text"
                              placeholder="Your first name"
                              value={registerFirstName}
                              onChange={(e) => setRegisterFirstName(e.target.value)}
                              required
                              disabled={registerLoading}
                              className="border-0 bg-light"
                            />
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label className="text-forest-dark font-medium">Last Name</Form.Label>
                            <Form.Control
                              type="text"
                              placeholder="Your last name"
                              value={registerLastName}
                              onChange={(e) => setRegisterLastName(e.target.value)}
                              required
                              disabled={registerLoading}
                              className="border-0 bg-light"
                            />
                          </Form.Group>
                        </Col>
                      </Row>

                      <Form.Group className="mb-4">
                        <Form.Label className="text-forest-dark font-medium">Email Address</Form.Label>
                        <Form.Control
                          type="email"
                          placeholder="Enter your email"
                          value={registerEmail}
                          onChange={(e) => setRegisterEmail(e.target.value)}
                          required
                          disabled={registerLoading}
                          className="border-0 bg-light"
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label className="text-forest-dark font-medium">Password</Form.Label>
                        <Form.Control
                          type="password"
                          placeholder="Create a strong password"
                          value={registerPassword}
                          onChange={(e) => setRegisterPassword(e.target.value)}
                          required
                          disabled={registerLoading}
                          className="border-0 bg-light"
                        />
                        <Form.Text className="text-muted">
                          Must be at least 8 characters with uppercase, lowercase, and numbers
                        </Form.Text>
                      </Form.Group>

                      {/* Password Strength Indicator */}
                      {registerPassword && (
                        <div className="mb-4">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <small className="text-muted">Password Strength</small>
                            <small className={`text-${
                              passwordStrength <= 1 ? 'danger' : 
                              passwordStrength === 2 ? 'warning' : 'success'
                            }`}>
                              {passwordStrength <= 1 ? 'Weak' : 
                               passwordStrength === 2 ? 'Fair' : 
                               passwordStrength === 3 ? 'Good' : 'Strong'}
                            </small>
                          </div>
                          <div className="progress" style={{height: '4px'}}>
                            <div 
                              className={`progress-bar ${getPasswordStrengthColor()}`}
                              style={{width: getPasswordStrengthWidth()}}
                            ></div>
                          </div>
                        </div>
                      )}

                      <Form.Group className="mb-4">
                        <Form.Label className="text-forest-dark font-medium">Confirm Password</Form.Label>
                        <Form.Control
                          type="password"
                          placeholder="Confirm your password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          disabled={registerLoading}
                          className="border-0 bg-light"
                          isInvalid={confirmPassword && !passwordsMatch}
                        />
                        <Form.Control.Feedback type="invalid">
                          Passwords do not match
                        </Form.Control.Feedback>
                      </Form.Group>

                      <div className="space-y-3 mb-6">
                        <Form.Check
                          type="checkbox"
                          id="terms-agree"
                          required
                          checked={agreeTerms}
                          onChange={(e) => setAgreeTerms(e.target.checked)}
                          disabled={registerLoading}
                          label={
                            <small className="text-muted">
                              I agree to the <a href="#" className="text-forest-medium hover:text-leaf-green">Terms of Service</a> 
                              and <a href="#" className="text-forest-medium hover:text-leaf-green">Privacy Policy</a>
                            </small>
                          }
                        />
                        
                        <Form.Check
                          type="checkbox"
                          id="newsletter"
                          checked={subscribeNewsletter}
                          onChange={(e) => setSubscribeNewsletter(e.target.checked)}
                          disabled={registerLoading}
                          label={
                            <small className="text-muted">
                              Send me tips, recipes, and updates about SmartGrocery (optional)
                            </small>
                          }
                        />
                      </div>

                      {registerError && (
                        <Alert variant="danger" className="mb-4">
                          {registerError}
                        </Alert>
                      )}

                      <Button
                        type="submit"
                        className="w-100 py-3"
                        disabled={
                          registerLoading || 
                          !registerFirstName || 
                          !registerLastName || 
                          !registerEmail || 
                          !registerPassword || 
                          !confirmPassword ||
                          !agreeTerms ||
                          !passwordsMatch
                        }
                      >
                        {registerLoading ? (
                          <>
                            <Spinner size="sm" className="me-2" />
                            Creating Account...
                          </>
                        ) : (
                          "Create Account"
                        )}
                      </Button>
                    </Form>
                  </div>
                )}
              </Card.Body>

              {/* Footer */}
              <Card.Footer className="bg-light text-center py-4 border-0">
                <p className="text-sm text-text-secondary mb-0">
                  {activeTab === "login" 
                    ? "Don't have an account? " 
                    : "Already have an account? "}
                  <button
                    onClick={() => setActiveTab(activeTab === "login" ? "register" : "login")}
                    className="text-forest-medium hover:text-leaf-green font-medium border-0 bg-transparent"
                    disabled={loginLoading || registerLoading}
                  >
                    {activeTab === "login" ? "Sign up" : "Sign in"}
                  </button>
                </p>
              </Card.Footer>
            </Card>

            {/* Features Section */}
            <div className="mt-8 text-center">
              <div className="row g-4">
                <div className="col-md-4">
                  <div className="p-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-leaf-green to-mint-light rounded-full flex items-center justify-center mx-auto mb-3">
                      <i className="bi bi-list-check text-white text-xl"></i>
                    </div>
                    <h3 className="font-semibold text-forest-dark mb-2">Smart Lists</h3>
                    <p className="text-sm text-text-secondary">
                      AI-powered suggestions and automatic categorization
                    </p>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="p-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-leaf-green to-mint-light rounded-full flex items-center justify-center mx-auto mb-3">
                      <i className="bi bi-people text-white text-xl"></i>
                    </div>
                    <h3 className="font-semibold text-forest-dark mb-2">Family Sharing</h3>
                    <p className="text-sm text-text-secondary">
                      Share lists and collaborate with family members
                    </p>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="p-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-leaf-green to-mint-light rounded-full flex items-center justify-center mx-auto mb-3">
                      <i className="bi bi-clock text-white text-xl"></i>
                    </div>
                    <h3 className="font-semibold text-forest-dark mb-2">Expiry Tracking</h3>
                    <p className="text-sm text-text-secondary">
                      Never waste food with smart expiry notifications
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
}
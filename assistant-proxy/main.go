package main

import (
	"bytes"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/patrickmn/go-cache"
)

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

func parseLogLevel(levelStr string) slog.Level {
	switch levelStr {
	case "DEBUG", "debug":
		return slog.LevelDebug
	case "INFO", "info":
		return slog.LevelInfo
	case "WARN", "warn", "WARNING", "warning":
		return slog.LevelWarn
	case "ERROR", "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// Config holds all configuration for the proxy
type Config struct {
	LlamaStackURL      string
	ProxyPort          int
	EnableTLS          bool
	TLSCertFile        string
	TLSKeyFile         string
	LoggingLevelStr    string
	LogLevel           slog.Level
	ArgoCDURL          string
	InsecureSkipVerify bool
	TargetURL          *url.URL
	TokenCache         *cache.Cache
}

// responseWriter wraps http.ResponseWriter to capture response data
type responseWriter struct {
	http.ResponseWriter
	statusCode int
	body       *bytes.Buffer
	headers    map[string]string
}

func newResponseWriter(w http.ResponseWriter) *responseWriter {
	return &responseWriter{
		ResponseWriter: w,
		statusCode:     http.StatusOK,
		body:           &bytes.Buffer{},
		headers:        make(map[string]string),
	}
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.captureHeaders()
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	// If WriteHeader hasn't been called yet, it will be called automatically with 200
	// Capture headers now if they haven't been captured
	if rw.statusCode == http.StatusOK && len(rw.headers) == 0 {
		rw.captureHeaders()
	}
	rw.body.Write(b)
	return rw.ResponseWriter.Write(b)
}

func (rw *responseWriter) captureHeaders() {
	for key, values := range rw.ResponseWriter.Header() {
		rw.headers[key] = fmt.Sprintf("%v", values)
	}
}

// loadConfig loads configuration from environment variables
func loadConfig() (*Config, error) {
	llamaStackURL := getEnv("LLAMA_STACK_URL", "http://localhost:8321")
	loggingLevelStr := getEnv("LOGGING_LEVEL", "INFO")
	logLevel := parseLogLevel(loggingLevelStr)

	// Parse the target URL
	target, err := url.Parse(llamaStackURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse LLAMA_STACK_URL %s: %w", llamaStackURL, err)
	}

	config := &Config{
		LlamaStackURL:      llamaStackURL,
		ProxyPort:          getEnvInt("PROXY_PORT", 8080),
		EnableTLS:          getEnvBool("ENABLE_TLS", false),
		TLSCertFile:        getEnv("TLS_CERT_FILE", ""),
		TLSKeyFile:         getEnv("TLS_KEY_FILE", ""),
		LoggingLevelStr:    loggingLevelStr,
		LogLevel:           logLevel,
		ArgoCDURL:          getEnv("ARGO_CD_URL", ""),
		InsecureSkipVerify: getEnvBool("INSECURE_SKIP_VERIFY", false),
		TargetURL:          target,
		TokenCache:         cache.New(cache.NoExpiration, cache.NoExpiration), // Will set expiration per item
	}

	return config, nil
}

// setupLogger configures the slog logger based on the config
func setupLogger(config *Config) {
	opts := &slog.HandlerOptions{
		Level: config.LogLevel,
	}
	handler := slog.NewTextHandler(os.Stdout, opts)
	logger := slog.New(handler)
	slog.SetDefault(logger)
}

func main() {
	// Load configuration from environment variables
	config, err := loadConfig()
	if err != nil {
		slog.Error("Failed to load configuration", "error", err)
		os.Exit(1)
	}

	// Setup logger
	setupLogger(config)

	slog.Info("Starting reverse proxy server",
		"target_url", config.LlamaStackURL,
		"proxy_port", config.ProxyPort,
		"https_enabled", config.EnableTLS,
		"logging_level", config.LoggingLevelStr)

	// Create reverse proxy
	proxy := createProxy(config)

	// Modify the request
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Host = config.TargetURL.Host
		slog.Info("Proxying request",
			"method", req.Method,
			"path", req.URL.Path,
			"target", config.LlamaStackURL+req.URL.Path)
	}

	// Helper function to handle requests with debug logging
	handleRequest := createRequestHandler(config, proxy)

	// Create HTTP handler
	http.HandleFunc("/assistant", handleRequest)

	// Handle /assistant/ with trailing slash
	http.HandleFunc("/assistant/", handleRequest)

	// Start server
	startServer(config)
}

// createProxy creates and configures the reverse proxy
func createProxy(config *Config) *httputil.ReverseProxy {
	proxy := httputil.NewSingleHostReverseProxy(config.TargetURL)

	// Configure transport for HTTPS if needed
	if config.TargetURL.Scheme == "https" {
		transport := &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: config.InsecureSkipVerify,
			},
		}
		proxy.Transport = transport
	}

	return proxy
}

// createRequestHandler creates the HTTP request handler function
func createRequestHandler(config *Config, proxy *httputil.ReverseProxy) func(http.ResponseWriter, *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		// Validate JWT token from cookie
		token := getTokenFromCookie(r)
		if token == "" {
			slog.Warn("No token found in request", "remote_addr", r.RemoteAddr, "path", r.URL.Path)
			http.Error(w, "Forbidden: No authentication token provided", http.StatusForbidden)
			return
		}

		valid, err := validateJWTToken(config, token)
		if err != nil {
			slog.Warn("Token validation error", "error", err, "remote_addr", r.RemoteAddr, "path", r.URL.Path)
			http.Error(w, "Forbidden: Token validation failed", http.StatusForbidden)
			return
		}

		if !valid {
			slog.Warn("Invalid token", "remote_addr", r.RemoteAddr, "path", r.URL.Path)
			http.Error(w, "Forbidden: Invalid authentication token", http.StatusForbidden)
			return
		}

		// Strip the /assistant prefix from the path
		r.URL.Path = r.URL.Path[len("/assistant"):]
		if r.URL.Path == "" {
			r.URL.Path = "/"
		}

		// Replace {{argocd.token}} in request body for specific endpoint
		if r.URL.Path == "/v1/openai/v1/responses" && r.Body != nil {
			bodyBytes, err := io.ReadAll(r.Body)
			if err != nil {
				slog.Warn("Failed to read request body", "error", err, "path", r.URL.Path)
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				return
			}
			r.Body.Close()

			// Replace {{argocd.token}} with actual token value
			bodyStr := string(bodyBytes)
			bodyStr = strings.ReplaceAll(bodyStr, "{{argocd.token}}", token)

			// Update request body with modified content
			r.Body = io.NopCloser(bytes.NewBufferString(bodyStr))
			r.ContentLength = int64(len(bodyStr))

			slog.Debug("Replaced {{argocd.token}} in request body", "path", r.URL.Path)
		}

		// Log request with headers at debug level
		if config.LogLevel <= slog.LevelDebug {
			// Read request body if present
			var requestBody []byte
			if r.Body != nil {
				requestBody, _ = io.ReadAll(r.Body)
				r.Body = io.NopCloser(bytes.NewBuffer(requestBody))
			}

			// Log request details
			headers := make(map[string]string)
			for key, values := range r.Header {
				headers[key] = fmt.Sprintf("%v", values)
			}

			slog.Debug("HTTP Request",
				"method", r.Method,
				"url", r.URL.String(),
				"proto", r.Proto,
				"remote_addr", r.RemoteAddr,
				"headers", headers,
				"body", string(requestBody))
		}

		// Wrap response writer to capture response
		var responseWriter http.ResponseWriter = w
		if config.LogLevel <= slog.LevelDebug {
			rw := newResponseWriter(w)
			responseWriter = rw
			defer func() {
				// Log response details
				slog.Debug("HTTP Response",
					"status_code", rw.statusCode,
					"headers", rw.headers,
					"body", rw.body.String())
			}()
		}

		proxy.ServeHTTP(responseWriter, r)
	}
}

// getTokenFromCookie extracts the JWT token from the argocd.token cookie
func getTokenFromCookie(r *http.Request) string {
	cookie, err := r.Cookie("argocd.token")
	if err != nil {
		return ""
	}
	return cookie.Value
}

// validateJWTToken validates a JWT token by checking cache first, then calling Argo CD API
func validateJWTToken(config *Config, tokenString string) (bool, error) {
	if tokenString == "" {
		return false, fmt.Errorf("token is empty")
	}

	// Check cache first
	if _, found := config.TokenCache.Get(tokenString); found {
		slog.Debug("Token found in cache", "token_prefix", tokenString[:min(20, len(tokenString))])
		return true, nil
	}

	// Parse JWT to get expiration time (without verification, Argo CD API will verify)
	// Split the token to get the payload
	parts := strings.Split(tokenString, ".")
	if len(parts) != 3 {
		return false, fmt.Errorf("invalid token format")
	}

	// Decode the payload (second part) - JWT uses base64url encoding without padding
	payload := parts[1]
	decoded, err := base64.RawURLEncoding.DecodeString(payload)
	if err != nil {
		return false, fmt.Errorf("failed to decode token payload: %w", err)
	}

	// Parse JSON claims
	var claims map[string]interface{}
	if err := json.Unmarshal(decoded, &claims); err != nil {
		return false, fmt.Errorf("failed to parse token claims: %w", err)
	}

	// Get expiration time from token
	var expiration time.Duration
	if exp, ok := claims["exp"].(float64); ok {
		expTime := time.Unix(int64(exp), 0)
		now := time.Now()
		if expTime.Before(now) {
			return false, fmt.Errorf("token is expired")
		}
		// Set cache expiration to match token expiration
		expiration = time.Until(expTime)
	} else {
		// If no expiration, use a default (e.g., 1 hour)
		expiration = time.Hour
	}

	// Validate token with Argo CD API
	if config.ArgoCDURL == "" {
		return false, fmt.Errorf("ARGO_CD_URL is not configured")
	}

	valid, err := validateTokenWithArgoCD(config, tokenString)
	if err != nil {
		return false, fmt.Errorf("failed to validate token with Argo CD: %w", err)
	}

	if valid {
		// Cache the token with expiration matching token expiration
		config.TokenCache.Set(tokenString, true, expiration)
		slog.Debug("Token validated and cached",
			"token_prefix", tokenString[:min(20, len(tokenString))],
			"expiration", expiration)
	}

	return valid, nil
}

// validateTokenWithArgoCD calls the Argo CD API to validate the token
func validateTokenWithArgoCD(config *Config, tokenString string) (bool, error) {
	argoCDURL, err := url.Parse(config.ArgoCDURL)
	if err != nil {
		return false, fmt.Errorf("invalid ARGO_CD_URL: %w", err)
	}

	// Build the userinfo endpoint URL
	baseURL := strings.TrimSuffix(config.ArgoCDURL, "/")
	userInfoURL := fmt.Sprintf("%s/api/v1/session/userinfo", baseURL)

	// Create HTTP client
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	// If Argo CD uses HTTPS, configure TLS
	if argoCDURL.Scheme == "https" {
		client.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: config.InsecureSkipVerify,
			},
		}
	}

	// Create request
	req, err := http.NewRequest("GET", userInfoURL, nil)
	if err != nil {
		return false, fmt.Errorf("failed to create request: %w", err)
	}

	// Set the cookie with the token
	req.Header.Set("Cookie", fmt.Sprintf("argocd.token=%s", tokenString))

	// Make the request
	resp, err := client.Do(req)
	if err != nil {
		return false, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	// Check if the response is successful (200 OK)
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		slog.Debug("Argo CD API returned non-200 status",
			"status_code", resp.StatusCode,
			"body", string(body))
		return false, nil
	}

	// Try to parse the response to ensure it's valid JSON
	var userInfo map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		slog.Debug("Failed to parse userinfo response", "error", err)
		return false, nil
	}

	// If we got valid user info, the token is valid
	return true, nil
}

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// startServer starts the HTTP or HTTPS server based on configuration
func startServer(config *Config) {
	addr := fmt.Sprintf(":%d", config.ProxyPort)
	if config.EnableTLS {
		if config.TLSCertFile == "" || config.TLSKeyFile == "" {
			slog.Error("TLS_CERT_FILE and TLS_KEY_FILE must be set when ENABLE_TLS is true")
			os.Exit(1)
		}
		slog.Info("Starting HTTPS server", "address", addr)
		if err := http.ListenAndServeTLS(addr, config.TLSCertFile, config.TLSKeyFile, nil); err != nil {
			slog.Error("Failed to start HTTPS server", "address", addr, "error", err)
			os.Exit(1)
		}
	} else {
		slog.Info("Starting HTTP server", "address", addr)
		if err := http.ListenAndServe(addr, nil); err != nil {
			slog.Error("Failed to start HTTP server", "address", addr, "error", err)
			os.Exit(1)
		}
	}
}

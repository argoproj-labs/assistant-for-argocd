package main

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strconv"
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

func main() {
	// Get configuration from environment variables
	llamaStackURL := getEnv("LLAMA_STACK_URL", "http://localhost:8321")
	proxyPort := getEnvInt("PROXY_PORT", 8080)
	enableTLS := getEnvBool("ENABLE_TLS", false)
	tlsCertFile := getEnv("TLS_CERT_FILE", "")
	tlsKeyFile := getEnv("TLS_KEY_FILE", "")
	loggingLevelStr := getEnv("LOGGING_LEVEL", "INFO")

	// Set log level from environment variable
	logLevel := parseLogLevel(loggingLevelStr)
	opts := &slog.HandlerOptions{
		Level: logLevel,
	}
	handler := slog.NewTextHandler(os.Stdout, opts)
	logger := slog.New(handler)
	slog.SetDefault(logger)

	// Parse the target URL
	target, err := url.Parse(llamaStackURL)
	if err != nil {
		slog.Error("Failed to parse LLAMA_STACK_URL", "url", llamaStackURL, "error", err)
		os.Exit(1)
	}

	slog.Info("Starting reverse proxy server",
		"target_url", llamaStackURL,
		"proxy_port", proxyPort,
		"https_enabled", enableTLS,
		"logging_level", loggingLevelStr)

	// Create reverse proxy
	proxy := httputil.NewSingleHostReverseProxy(target)

	// Configure transport for HTTPS if needed
	if target.Scheme == "https" {
		transport := &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: getEnvBool("INSECURE_SKIP_VERIFY", false),
			},
		}
		proxy.Transport = transport
	}

	// Modify the request
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Host = target.Host
		slog.Info("Proxying request",
			"method", req.Method,
			"path", req.URL.Path,
			"target", llamaStackURL+req.URL.Path)
	}

	// Helper function to handle requests with debug logging
	handleRequest := func(w http.ResponseWriter, r *http.Request) {
		// Strip the /assistant prefix from the path
		r.URL.Path = r.URL.Path[len("/assistant"):]
		if r.URL.Path == "" {
			r.URL.Path = "/"
		}

		// Log request with headers at debug level
		if logLevel <= slog.LevelDebug {
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
		if logLevel <= slog.LevelDebug {
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

	// Create HTTP handler
	http.HandleFunc("/assistant", handleRequest)

	// Handle /assistant/ with trailing slash
	http.HandleFunc("/assistant/", handleRequest)

	// Start server
	addr := fmt.Sprintf(":%d", proxyPort)
	if enableTLS {
		if tlsCertFile == "" || tlsKeyFile == "" {
			slog.Error("TLS_CERT_FILE and TLS_KEY_FILE must be set when ENABLE_TLS is true")
			os.Exit(1)
		}
		slog.Info("Starting HTTPS server", "address", addr)
		if err := http.ListenAndServeTLS(addr, tlsCertFile, tlsKeyFile, nil); err != nil {
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

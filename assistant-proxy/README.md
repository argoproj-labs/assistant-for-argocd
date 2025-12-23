# Reverse Proxy for llama-stack

This Go reverse proxy forwards requests from the `/assistant` path to a llama-stack instance.

## Configuration

The proxy can be configured using the following environment variables:

### Target Configuration

- `LLAMA_STACK_URL` - Complete URL of the llama-stack instance (default: `http://localhost:8321`)
- `INSECURE_SKIP_VERIFY` - Skip TLS certificate verification when connecting to llama-stack via HTTPS (default: `false`)

### Proxy Server Configuration

- `PROXY_PORT` - Port on which the proxy server listens (default: `8080`)
- `ENABLE_TLS` - Enable HTTPS for the proxy server itself (default: `false`)
- `TLS_CERT_FILE` - Path to TLS certificate file (required if `ENABLE_TLS=true`)
- `TLS_KEY_FILE` - Path to TLS private key file (required if `ENABLE_TLS=true`)
- `LOGGING_LEVEL` - Logging level for all slog logging: `DEBUG`, `INFO`, `WARN`, or `ERROR` (default: `INFO`)

## Usage

### Basic HTTP Proxy

```bash
go run main.go
```

This will start the proxy on port 8080, forwarding requests from `/assistant` to `http://localhost:8321`.

### Custom Configuration

```bash
export LLAMA_STACK_URL=https://llama-stack.example.com:8321
export PROXY_PORT=9090
go run main.go
```

### HTTPS Proxy

To enable HTTPS for the proxy server itself:

```bash
export ENABLE_TLS=true
export TLS_CERT_FILE=/path/to/cert.pem
export TLS_KEY_FILE=/path/to/key.pem
go run main.go
```

### Logging Levels

The proxy uses structured logging via Go's `log/slog` package. The logging level can be controlled with the `LOGGING_LEVEL` environment variable:

```bash
export LOGGING_LEVEL=DEBUG
go run main.go
```

Available log levels (case-insensitive):
- `DEBUG` - Most verbose, includes detailed HTTP request/response information
- `INFO` - Default level, includes general operational information
- `WARN` - Warning messages only
- `ERROR` - Error messages only

When `LOGGING_LEVEL` is set to `DEBUG`, the proxy will log:
- **HTTP Request**: Method, URL, protocol, remote address, headers, and body
- **HTTP Response**: Status code, headers, and body

These are logged separately at debug level using structured logging.

### Building

To build the proxy:

```bash
go build -o proxy main.go
```

Then run:

```bash
./proxy
```

## Request Flow

1. Client sends request to `http://proxy:8080/assistant/api/chat`
2. Proxy strips `/assistant` prefix
3. Proxy forwards request to `http://llama-stack:8321/api/chat`
4. Response is returned to the client


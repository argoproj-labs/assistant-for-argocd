.PHONY: build clean

# Binary directory
current_dir := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
BIN_DIR := $(patsubst %/,%,$(current_dir))/build/bin

$(info Binary directory is $(BIN_DIR))

# Binary name
BINARY_NAME=assistant-proxy

# Build the binary
build:
	@echo "Building $(BIN_DIR)/$(BINARY_NAME)..."
	@go build -o $(BIN_DIR)/$(BINARY_NAME) main.go
	@echo "Build complete: $(BIN_DIR)/$(BINARY_NAME)"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf $(BIN_DIR)
	@echo "Clean complete"

# Make self-contained production binary
package:
	@echo "Building production binary $(BIN_DIR)/$(BINARY_NAME)..."
	CGO_ENABLED=0 GOARCH=$(BIN_ARCH) GOOS=$(BIN_OS) go build -v -o $(BIN_DIR)/$(BINARY_NAME) -ldflags '$(LDFLAGS)' assistant-for-argocd-proxy

# Default target
.DEFAULT_GOAL := build


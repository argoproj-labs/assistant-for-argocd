### Providers

There are two llama-stack providers as follows:

1. *LLama-Stack*. This is the original provider, it uses the Agent API which has been deprecated in
llama-stack. This provider is not recommended but remains available if needed.
2. *LLama-Stack-V2*. This is the newer provider, it uses the Open AI Responses API and should be more compatible
with later llama-stack versions given this is the recommended API from llama-stack.

### Installation

*Prerequistes*: You must have llama-stack installed and configured with at least one inference engine. An example of doing
this with OpenAI as the inference engine is in `examples/manifests/llama-stack/base`.

Install the extension into the Argo CD instance by adding the following in the appropriate spots, note here we are using
the Argo CD Operator but feel free to adapt it for the `argcd-cm` ConfigMap if you have deployed Argo CD using the Helm chart:

```
apiVersion: argoproj.io/v1beta1
kind: ArgoCD
metadata:
  name: openshift-gitops
  namespace: openshift-gitops
spec:
  rbac:
    ...
    # This is needed to allow the extension to communicate with the proxy-extension
    # defined in extraConfig. Note the name `assistant` must match the proxy-extension
    # name.
    p, role:readonly, extensions, invoke, assistant, allow
  # Configuration items that are placed in
  extraConfig:
    # Define the extension end point
    extension.config.assistant: |
      connectionTimeout: 2s
      keepAlive: 360s
      idleConnectionTimeout: 360s
      maxIdleConnections: 30
      services:
        # Note if you use HTTPS it needs to be a valid certificate or the CA
        # needs to be installed in the server component otherwise the
        # Argo CD Proxy Extension will fail.
        #
        # Adjust this URL to wherever you have llama-stack installed.
      - url: http://llamastack.llamastack.svc.cluster.local:8321
  server:
    # Enabled proxy extensions in the server component
    extraCommandArgs:
      - "--enable-proxy-extension"
    # Install the extension, update the x.y.z version to match the latest
    initContainers:
      - env:
          - name: EXTENSION_URL
            value: "https://github.com/argoproj-labs/assistant-for-argocd/releases/download/v0.2.2/extension-assistant-0.2.2.tar"
        image: "quay.io/argoprojlabs/argocd-extension-installer:v0.0.8"
        name: extension-assistant
        securityContext:
          allowPrivilegeEscalation: false
        volumeMounts:
          - name: extensions
            mountPath: /tmp/extensions/
    volumes:
      - name: extensions
        emptyDir: {}
```

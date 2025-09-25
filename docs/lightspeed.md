### Installation

### Installing POC on Existing Cluster

*Prerequistes*: You muse have the OpenShift Lightspeed operator installed and configured on the cluster.

1. In the `openshift-lightspeed` namespace create a new NetworkPolicy to allow the Argo CD extension to talk
to the Lightspeed service. This is required because Lightspeed has a default NetworkPolicy that will
prevent Argo CD from reaching the `lightspeed-app` pod running in the `openshift-lightspeed` namespace.

Note you can add any additional Argo CD instances you want to use the extension to the NetworkPolicy.

```
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  labels:
    app.kubernetes.io/component: application-server
    app.kubernetes.io/name: lightspeed-service-api
    app.kubernetes.io/part-of: openshift-lightspeed
  name: lightspeed-app-server-gitops
  namespace: openshift-lightspeed
spec:
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: openshift-gitops
      podSelector:
        matchExpressions:
        - key: app.kubernetes.io/name
          operator: In
          values:
          - openshift-gitops-server
    ports:
    - port: 8443
      protocol: TCP
  podSelector:
    matchLabels:
      app.kubernetes.io/component: application-server
      app.kubernetes.io/managed-by: lightspeed-operator
      app.kubernetes.io/name: lightspeed-service-api
      app.kubernetes.io/part-of: openshift-lightspeed
  policyTypes:
  - Ingress
```

2. Lightspeed requires an OpenShift token, in the console it uses the user's token but Argo CD UI does not have this token. As a result
we will create a ServiceAccount and then create a token against that. To do so create the following ServiceAccount and Secret:

```
kind: ServiceAccount
apiVersion: v1
metadata:
  name: lightspeed-auth
  namespace: openshift-gitops
---
apiVersion: v1
kind: Secret
metadata:
  name: lightspeed-auth-secret
  annotations:
    kubernetes.io/service-account.name: lightspeed-auth
type: kubernetes.io/service-account-token
```

3. You will need to copy the token into the argocd-secret with the key `argocd-secret`. If you want to do this
in a GitOps way you use ExternalSecrets to take the secret from step 2 and insert it into the
existing `argocd-secret` as per this [example](https://github.com/gnunn-gitops/acm-hub-bootstrap/blob/main/components/policies/gitops/base/manifests/gitops-lightspeed/base/lightspeed-external-secret.yaml).

4. Add a ClusterRoleBinding to allow the `lightspeed-auth` service account to call the Lightspeed API, again adjust as needed
for your Argo CD instance(s).

```
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: token-reviewer
rules:
- apiGroups: ["authentication.k8s.io"]
  resources: ["tokenreviews"]
  verbs: ["create"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: argocd-assistant-gitops-access
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: lightspeed-operator-query-access
subjects:
- kind: ServiceAccount
  name: lightspeed-auth
  namespace: openshift-gitops
---
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: lightspeed-auth-token-reviewer
subjects:
  - kind: ServiceAccount
    name: lightspeed-auth
    namespace: openshift-gitops
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: token-reviewer
```

5. The extension talks to the Lightspeed Kubernetes service which uses TLS provided
by the OpenShift [Service CA Operator](https://docs.redhat.com/en/documentation/openshift_container_platform/4.19/html/security_and_compliance/certificate-types-and-descriptions#cert-types-service-ca-certificates),
you will need the Service CA for the Argo CD proxy extension to trust it.

```
apiVersion: v1
kind: ConfigMap
metadata:
  name: config-service-cabundle
  namespace: openshift-gitops
  annotations:
    service.beta.openshift.io/inject-cabundle: true
data: {}
```

6. Install the extension into the Argo CD instance by adding the following in the appropriate spots:

```
apiVersion: argoproj.io/v1beta1
kind: ArgoCD
metadata:
  name: openshift-gitops
  namespace: openshift-gitops
spec:
  rbac:
    ...
    p, role:readonly, extensions, invoke, lightspeed, allow
  extraConfig:
    extension.config.lightspeed: |
      connectionTimeout: 2s
      keepAlive: 360s
      idleConnectionTimeout: 360s
      maxIdleConnections: 30
      services:
      - url: https://lightspeed-app-server.openshift-lightspeed.svc.cluster.local:8443
        headers:
        - name: Authorization
          value: '$lightspeed.auth.header'
  server:
    annotations:
      # Needed to support longer queries to lightspeed
      haproxy.router.openshift.io/timeout: 360s
    extraCommandArgs:
      - "--enable-proxy-extension"
    initContainers:
      - env:
          - name: EXTENSION_URL
            value: "https://github.com/argoproj-labs/assistant-for-argocd/releases/download/v0.2.1/extension-assistant-0.2.1.tar"
        image: "quay.io/argoprojlabs/argocd-extension-installer:v0.0.8"
        name: extension-lightspeed
        securityContext:
          allowPrivilegeEscalation: false
        volumeMounts:
          - name: extensions
            mountPath: /tmp/extensions/
    volumeMounts:
      - mountPath: /etc/pki/tls/certs/service-ca.crt
        name: config-service-cabundle
        subPath: service-ca.crt
    volumes:
      - configMap:
          name: config-service-cabundle
          defaultMode: 420
        name: config-service-cabundle
        optional: true
```

7. The llama-stack provider is the default, you will need to create a Lightspeed settings extension to use Lightspeed as the backend. An example of the settings can be found [here](https://github.com/argoproj-labs/assistant-for-argocd/blob/main/examples/settings/lightspeed/extension-basic-settings.js).

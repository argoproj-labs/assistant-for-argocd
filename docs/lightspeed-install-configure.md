## Lightspeed and OpenShift GitOps Installation and Configuration Guide
### Prerequisites
- OpenShift Cluster with v4.19 or later

### Installation of OpenShift LightSpeed (OLS)

#### Create the namespace `openshift-lightspeed`
```
oc create ns openshift-lightspeed
```
#### Create the OperatorGroup
```
oc create -f - <<EOF
apiVersion: operators.coreos.com/v1
kind: OperatorGroup
metadata:
  name: openshift-lightspeed-og
  namespace: openshift-lightspeed
spec:
  targetNamespaces:
  - openshift-lightspeed
  upgradeStrategy: Default
EOF
```
#### Create the Subscription Object for OpenShift Lightspeed v1.0.6 or later
```
oc create -f - <<EOF
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  labels:
      operators.coreos.com/lightspeed-operator.openshift-lightspeed: ""
  name: lightspeed-operator
  namespace: openshift-lightspeed

spec:
  channel: stable
  installPlanApproval: Automatic
  name: lightspeed-operator
  source: redhat-operators
  sourceNamespace: openshift-marketplace
  startingCSV: lightspeed-operator.v1.0.6
EOF
```
### Wait till the operator deployment is complete
```
oc rollout status deploy/lightspeed-operator-controller-manager  -n openshift-lightspeed
```
### Creation of OLSConfig

#### OpenAI

#### Create an API Token in OpenAI site
Visit the OpenAI [https://platform.openai.com/account/api-keys] and create a new API token. Copy the token and paste in a file under `$HOME/.openai.token`

#### Create a secret containing the OpenAI token
```
oc create secret generic openai-token --from-file=apitoken=$HOME/.openai.token -n openshift-lightspeed
```
#### Create the OLSConfig as below
```
oc create -f - <<EOF
apiVersion: ols.openshift.io/v1alpha1
kind: OLSConfig
metadata:
  name: cluster
spec:
  llm:
    providers:
      - name: openai
        type: openai
        credentialsSecretRef:
          name: openai-token  # The name of the secret created in Step 2
        url: 'https://api.openai.com/v1'
        models:
          - name: gpt-5-nano
  ols:
    defaultModel: gpt-5-nano
    defaultProvider: openai
EOF
```
#### Wait for the lightspeed app server deployment to come up
```
oc rollout status deploy/lightspeed-app-server -n openshift-lightspeed
```
#### OpenAI on Azure
<TBD>
#### WatsonX
<TBD>

### Installation of OpenShift GitOps
#### Create the namespace `openshift-gitops`
```
oc create ns openshift-gitops-operator
```
#### Create the OperatorGroup
```
oc create -f - <<EOF
apiVersion: operators.coreos.com/v1
kind: OperatorGroup
metadata:
  name: openshift-gitops-og
  namespace: openshift-gitops-operator
  annotations:
    olm.providedAPIs: AnalysisRun.v1alpha1.argoproj.io,AnalysisTemplate.v1alpha1.argoproj.io,AppProject.v1alpha1.argoproj.io,Application.v1alpha1.argoproj.io,ApplicationSet.v1alpha1.argoproj.io,ArgoCD.v1alpha1.argoproj.io,ArgoCD.v1beta1.argoproj.io,ClusterAnalysisTemplate.v1alpha1.argoproj.io,Experiment.v1alpha1.argoproj.io,GitopsService.v1alpha1.pipelines.openshift.io,NamespaceManagement.v1beta1.argoproj.io,NotificationsConfiguration.v1alpha1.argoproj.io,Rollout.v1alpha1.argoproj.io,RolloutManager.v1alpha1.argoproj.io
spec:
  upgradeStrategy: Default
EOF
```
#### Create the subscription object for OpenShift GitOps 1.18.0 or later
```
oc create -f - <<EOF
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  labels:
    operators.coreos.com/openshift-gitops-operator.openshift-gitops-operator: ""
  name: openshift-gitops-operator
  namespace: openshift-gitops-operator
spec:
  channel: latest
  installPlanApproval: Automatic
  name: openshift-gitops-operator
  source: redhat-operators
  sourceNamespace: openshift-marketplace
  startingCSV: openshift-gitops-operator.v1.18.0
EOF
```
### Wait till the operator deployment is complete
```
oc rollout status deploy/openshift-gitops-operator-controller-manager -n openshift-gitops-operator
```

### Configure the default Argo CD instance `openshift-gitops`

#### Patch the ArgoCD spec.rbac policy
```
oc patch argocd openshift-gitops -n openshift-gitops --type=merge -p='{"spec":{"rbac":{"policy": "g, system:cluster-admins, role:admin\ng, cluster-admins, role:admin\np, role:readonly, extensions, invoke, assistant, allow"}}}'
```
### References


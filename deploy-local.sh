# Deploys by copying js file into pod to make it faster for round-trip development,
# haven't figured out yet how to live code the extension outside the pod.

# NAMESPACE=openshift-gitops
# LABEL_NAME=openshift-gitops-server

NAMESPACE=demo-gitops
LABEL_NAME=argocd-server

# The Settings file to use, this is installed as a second extension
# SETTINGS=examples/settings/llama-stack/extension-basic-settings.js

SETTINGS=extension-basic-settings.js

VERSION=$(node -p -e "require('./package.json').version")

yarn run build

POD=$(oc get pod -l app.kubernetes.io/name=$LABEL_NAME -o jsonpath="{.items[0].metadata.name}" -n $NAMESPACE)

echo "Deleting existing version of extension"

oc exec -it -n ${NAMESPACE} ${POD} -c argocd-server -- bash -c "rm -rf /tmp/extensions/resources/extensions-assistant/*"

echo "Make sure directory exists"

oc exec -it -n ${NAMESPACE} ${POD} -c argocd-server -- bash -c "mkdir -p /tmp/extensions/resources"

echo "Copying to pod $POD"

oc cp dist/resources/extensions-assistant/extension-assistant-bundle-${VERSION}.min.js $NAMESPACE/$POD:/tmp/extensions/resources/extension-assistant-bundle-${VERSION}.min.js

oc exec -it -n ${NAMESPACE} ${POD} -c argocd-server -- bash -c "mkdir -p /tmp/extensions/assistant-settings"

oc cp ${SETTINGS} $NAMESPACE/$POD:/tmp/extensions/assistant-settings/extension-settings.js


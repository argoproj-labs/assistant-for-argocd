# Deploys by copying js file into pod to make it faster for round-trip development,
# haven't figured out yet how to live code the extension outside the pod.

if [ -z "${NAMESPACE}" ]; then
  echo "Error: NAMESPACE is not set!" >&2
  exit 1
else
  echo "Value of NAMESPACE: $NAMESPACE"
fi
if [ -z "${LABEL_NAME}" ]; then
  echo "Error: LABEL_NAME is not set, set this to the name of the 'app.kubernetes.io/name' label for the 'server' pod" >&2
  exit 1
else
  echo "Value of LABEL_NAME: $LABEL_NAME"
fi
if [ -z "${SETTINGS}" ]; then
  echo "Warning: SETTINGS variable is not set, not copying any settings over" >&2
  exit 1
else
  echo "Value of SETTINGS: $SETTINGS"
fi


VERSION=$(node -p -e "require('./package.json').version")

yarn run build

POD=$(oc get pod -l app.kubernetes.io/name=$LABEL_NAME -o jsonpath="{.items[0].metadata.name}" -n $NAMESPACE)

echo "Deleting existing version of extension"

oc exec -it -n ${NAMESPACE} ${POD} -c argocd-server -- bash -c "rm -rf /tmp/extensions/resources/extensions-assistant/*"

echo "Make sure directory exists"

oc exec -it -n ${NAMESPACE} ${POD} -c argocd-server -- bash -c "mkdir -p /tmp/extensions/resources/extensions-assistant"

echo "Copying to pod $POD"

oc cp dist/resources/extensions-assistant/extension-assistant-bundle-${VERSION}.min.js $NAMESPACE/$POD:/tmp/extensions/resources/extensions-assistant/extension-assistant-bundle-${VERSION}.min.js

if [ -v SETTINGS ]; then
    echo "Copying settings"

    oc exec -it -n ${NAMESPACE} ${POD} -c argocd-server -- bash -c "rm -rf /tmp/extensions/resources/assistant-settings"
    oc exec -it -n ${NAMESPACE} ${POD} -c argocd-server -- bash -c "mkdir -p /tmp/extensions/resources/assistant-settings"
    oc cp ${SETTINGS} $NAMESPACE/$POD:/tmp/extensions/resources/assistant-settings/extension-settings.js
fi

// Basic settings example for Lightspeed. It shows using a Deepseek model with Red Hat's internal MaaS using RHOAI
var argocdAssistantSettings = {
    provider: "Lightspeed",
    model: "r1-qwen-14b-w4a16",
    data: {
        provider: "red_hat_openshift_ai",
    }
};

(() => {

    console.log("Initializing Argo CD Assistant Settings");
    console.log(globalThis.argocdAssistantSettings);

})();

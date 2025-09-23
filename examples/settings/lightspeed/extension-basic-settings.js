// Basic settings that assume you have a simple LLama Stack deployment using the OpenAI inference engine
// Basic settings that assume you have a simple LLama Stack deployment using the OpenAI inference engine
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

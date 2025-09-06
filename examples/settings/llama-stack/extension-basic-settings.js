// Basic settings that assume you have a simple LLama Stack deployment using the OpenAI inference engine
var argocdAssistantSettings = {
    model: "openai/openai/gpt-4o",
    provider: "Llama-Stack"
};

(() => {

    console.log("Initializing Argo CD Assistant Settings");
    console.log(globalThis.argocdAssistantSettings);

})();

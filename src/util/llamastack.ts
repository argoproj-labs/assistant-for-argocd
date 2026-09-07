import LlamaStackClient from "llama-stack-client";
import { QueryContext } from "../model/provider";

// Sentinel returned by getModel() when no models were available at lookup
// time. Callers must treat this as "unresolved", not a cacheable value -
// caching it as if it were a real model wedges every future conversation
// until the provider instance is recreated (e.g. a full page reload).
export const UNAVAILABLE_MODEL = "unavailable";

/**
 * Fetches the model to use, right now defaults based on first
 * available model that llama-stack returns but this needs to be
 * made configurable.
 *
 * @param client llama-stack client
 * @returns
 */
export async function getModel(client: LlamaStackClient, context: QueryContext): Promise<string> {

        // const providers = await client.providers.list();
        // console.log(providers);

        // ogx-server's GET /v1/models always returns the OpenAI-compatible shape
        // (id, custom_metadata.model_type) unless Anthropic/Google SDK detection
        // headers are present - there is no way to get the older native llama-stack
        // shape (identifier, model_type top-level) from this endpoint. Read both so
        // this works whether the backend returns the native or OpenAI-compat shape.
        const availableModels = (await client.models.list())
            .filter((model: any) => {
                const modelType = model.model_type ?? model.custom_metadata?.model_type;
                const identifier = model.identifier ?? model.id;
                return modelType === 'llm' &&
                    identifier != undefined &&
                    !identifier.includes('guard') &&
                    !identifier.includes('405');
            })
            .map((model: any) => model.identifier ?? model.id);

        console.log("Available Models from Llama-Stack");
        console.log(availableModels);

        // Check if the selected model is actually available in Llama-Stack
        // At this time only provide
        if (context.settings.model != undefined) {
            console.log("Configured model is %s", context.settings.model)
            if (!availableModels.includes(context.settings.model)) {
                console.warn("The selected model %s defined in settings is not available in the list of models reported by Llama-Stack", context.settings.model);
            }
            return context.settings.model;
        } else if (availableModels.length === 0) {
            console.warn('No available models in llama-stack available for use.');
            return UNAVAILABLE_MODEL;
        } else {
            return availableModels[0];
        }
    }

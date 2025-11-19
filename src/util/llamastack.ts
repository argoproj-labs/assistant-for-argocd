import LlamaStackClient from "llama-stack-client";
import { QueryContext } from "../model/provider";

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

        // Simple implementation to use first available model if one wasn't configured
        const availableModels = (await client.models.list())
            .filter((model: any) =>
                model.model_type === 'llm' &&
                !model.identifier.includes('guard') &&
                !model.identifier.includes('405')
            )
            .map((model: any) => model.identifier);

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
            return "unavailable";
        } else {
            return availableModels[0];
        }
    }

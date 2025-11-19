import { QueryProvider } from "../model/provider";
import { LlamaStackProvider } from "./llamaStackProvider";
import { LightspeedProvider } from "./lightspeedProvider";
import { LlamaStackV2Provider } from "./llamaStackV2Provider"

export enum Provider {
  LLAMA_STACK = "Llama-Stack",
  LLAMA_STACK_V2 = "Llama-Stack-V2",
  LIGHTSPEED = "Lightspeed"
}

export function createProvider(provider: Provider): QueryProvider {
    switch(provider) {
        case Provider.LIGHTSPEED: return new LightspeedProvider();
        case Provider.LLAMA_STACK_V2: return new LlamaStackV2Provider();
        default: return new LlamaStackProvider();
    }
}

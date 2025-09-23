import { QueryProvider } from "../model/provider";
import { LlamaStackProvider } from "./llamaStackProvider";
import { LightspeedProvider } from "./lightspeedProvider";


export enum Provider {
  LLAMA_STACK = "Llama-Stack",
  LIGHTSPEED = "Lightspeed"
}

export function createProvider(provider: Provider): QueryProvider {
    switch(provider) {
        case Provider.LIGHTSPEED: return new LightspeedProvider();
        default: return new LlamaStackProvider();
    }
}

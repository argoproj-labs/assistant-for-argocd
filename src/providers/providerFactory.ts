import { QueryProvider } from "../model/provider";
import { LlamaStackProvider } from "./llamaStackProvider";

export enum Provider {
  LLAMA_STACK = "Llama-Stack",
}

export function createProvider(provider: Provider): QueryProvider {
    switch(provider) {
        default: return new LlamaStackProvider();
    }
}

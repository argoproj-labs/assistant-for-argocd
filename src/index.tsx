
//import { FeatureFlags, isFeatureEnabled } from "./featureFlags";
import { FeatureFlags, isFeatureEnabled } from "./featureFlags";
import "./index.css"
import { ResourceAssistantExtension } from "./resourceExtension";
import { SystemAssistantExtension } from "./systemExtension";

export const resourceComponent = ResourceAssistantExtension;
export const systemComponent = SystemAssistantExtension;

((window: any) => {
    window?.extensionsAPI?.registerResourceExtension(resourceComponent, '**', '*', 'Assistant', { icon: 'fa-sharp fa-light fa-message fa-lg' });
    if (isFeatureEnabled(FeatureFlags.ArgoCDMCP)) {
         // TODO: Need to define a standalone System Level Extension that shares some code
         window?.extensionsAPI?.registerSystemLevelExtension(systemComponent, 'Assistant', "/assistant", 'fa-sharp fa-light fa-message fa-lg');
    }
})(window);

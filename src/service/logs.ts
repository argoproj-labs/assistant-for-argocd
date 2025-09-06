import { LogEntry } from "src/model/argocd";
import { getHeaders, Kinds } from "../util/util";

export const MAX_LINES = 250;

// Test if resource is a pod or something that has a PodSpec.
export function hasLogs(resource: any): boolean {
    return resource?.spec?.template?.spec?.containers || resource?.kind === Kinds.POD;
}

// Pull out group from API version
function getGroup(apiVersion:string):string {
    const index = apiVersion.indexOf("/");
    if (index > 0) return apiVersion.substring(0, index);
    else return apiVersion;
}

export const getLogs = async (application: any, resource: any, container: string, count: number): Promise<LogEntry[]> => {

    console.log(resource);

    const params = new URLSearchParams({
        appNamespace: application.metadata.namespace,
        namespace: resource.metadata.namespace,
        container: container,
        tailLines: String(count),
        follow: "false",
        sinceSeconds: "0"
    });

    if (resource.kind == Kinds.POD) {
        params.append("podName", resource.metadata.name);
    } else {
        params.append("resourceName", resource.metadata.name);
        params.append("kind", resource.kind);
        params.append("group", getGroup(resource.apiVersion));
    }

    const url = "/api/v1/applications/" + application.metadata.name + "/logs?" + params.toString();

    const request: RequestInfo = new Request(url, {
        credentials: 'include',
        method: 'GET',
        headers: getHeaders(application, false)
    });

    const response = await fetch(request);
    if (!response.ok || !response.body) {
        throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let partialData = '';
    let index = 0;

    var results: LogEntry[] = [];

    // Since we use the `tailLines` parameter we don't actually need to count the lines
    // and could just read until done. However just leaving it in for now for
    // flexibility.
    while (index <= count) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }

        partialData += decoder.decode(value, { stream: true });
        const parts = partialData.split('\n');
        partialData = parts.pop() || '';

        for (const part of parts) {
            try {
                const jsonObject = JSON.parse(part);
                console.log("jsonObject");
                console.log(jsonObject);
                results.push(jsonObject as LogEntry);
                index++;
                if (index > count) break;
            } catch (e) {
                // Ignore incomplete JSON objects
                //console.log(e);
            }
        }
    }

    return results;
}

import { Settings, Styles } from "react-chatbotify";

export enum ExtensionScope {
    Resource = "resource",
    System = "system"
}

/**
 * Styles used for chatbotify component, tried to match styles to
 * Argo CD colors.
 */
export const CHAT_STYLES: Styles = {
    // Handled with CSS now
    // chatWindowStyle: {
    //     width: "100%",
    //     // TODO: Figure out how to make this 100% without overflowing, using 80vh is a hacky
    //     // way to fix the overflow problem and possibly could break if users are scaling the UI
    //     height: "80vh"
    // },
    botBubbleStyle: {
        backgroundColor: "#6D7F8B",
        color: "#F8F8FB"
    },
    userBubbleStyle: {
        background: "#00A2B3",
        color: "#ffffff"
    }
}

export const chatSettings = (chatHistoryKey: string): Settings => {
    return {
        general: {
            showFooter: false,
            showHeader: false,
            embedded: true
        },
        fileAttachment: {
            disabled: true
        },
        chatHistory: {
            disabled: false,
            storageKey: chatHistoryKey,
            storageType: "SESSION_STORAGE",
            // More management of state needs to be done in this extension, it basically
            // looks every time a tab is switched the view gets re-loaded. Enabling this switch
            // brings back the state automatically but if the user attached logs they would lose
            // though which is confusing.
            autoLoad: true
        },
        chatWindow: {
            showScrollbar: true
        }
    }
};

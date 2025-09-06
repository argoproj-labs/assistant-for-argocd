import * as React from "react";

import "./ErrorMessage.css"

export type ErrorMessageProps = {
    title: string,
    message: string
}

export const ErrorMessage = (props: ErrorMessageProps) => {

    return (
        <div className="error-toast">
            <span className="error-title">{props.title}</span>
            <p>{props.message}</p>
        </div>
    );

}

export default ErrorMessage

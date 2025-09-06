import * as React from "react";
import * as dompurify from 'dompurify';

import { marked } from "marked";

const purifier = dompurify['default'] as dompurify.DOMPurify;

const MarkedWrapper = ({
    children
}: {
    children: React.ReactNode
}) => {
    const markdown = typeof children === "string" ?
        children.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;") :
        "";
    const text = marked.parse(purifier.sanitize(markdown), { async: false });
    return (
        <div dangerouslySetInnerHTML={{ __html: text }} />
    );
};

export default MarkedWrapper;

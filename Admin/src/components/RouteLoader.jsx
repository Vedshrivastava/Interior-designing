import React from 'react';

/*
 * The app's one "something is loading" visual — a fixed, full-viewport
 * overlay (index.css's .submit-loader-overlay/.loader-modal-box/
 * .loader-ring), already used for lazy-route transitions (App.jsx) and
 * every Add/Edit modal's own submit-in-progress state. Extracted here so
 * detail pages that gate their entire first render on a fetch (Project/
 * Client/Work Detail) can reuse it too, instead of a bare, unstyled
 * "Loading…" line sitting in normal document flow — which, having no
 * `position: fixed`, rendered wherever the page's scroll position from
 * the previous screen happened to leave it rather than staying put in
 * the viewport.
 */
const RouteLoader = () => (
    <div className="submit-loader-overlay">
        <div className="loader-modal-box">
            <div className="loader-ring"></div>
            <div className="loader-brand">
                <strong>Loading</strong>
                <span>Please wait</span>
            </div>
            <div className="loader-dots">
                <div className="loader-dot"></div>
                <div className="loader-dot"></div>
                <div className="loader-dot"></div>
            </div>
        </div>
    </div>
);

export default RouteLoader;

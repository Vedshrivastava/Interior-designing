import React from 'react';

/*
 * Wraps any download trigger (a real <button>, or this app's <p
 * className="edit-action">-as-button text-link style) with feedback for
 * the transfer itself — `downloading`/`progress` come straight from
 * useFileDownload's axios onDownloadProgress, so the percentage (or byte
 * count, when the server streams without a Content-Length) is real, not
 * simulated. Deliberately has no "done"/success state: once the transfer
 * finishes the button just goes back to idle, since whether the browser
 * has actually finished writing the file to disk isn't something any
 * webpage's JavaScript can observe — showing a checkmark at that point
 * would be a claim this component can't back up.
 * `as="p"` switches to this app's text-link action style
 * (RunningBillsManager/ClientDetail/ProjectDetail's "Statement"/"Download
 * Receipt" triggers); default is a real <button>.
 */
const DownloadButton = ({ as = 'button', downloading, progress, idleLabel, onClick, className = '', style }) => {
    const As = as;
    const label = downloading
        ? `Downloading…${progress?.label ? ` ${progress.label}` : ''}`
        : idleLabel;

    return (
        <As
            type={as === 'button' ? 'button' : undefined}
            onClick={downloading ? undefined : onClick}
            disabled={as === 'button' ? downloading : undefined}
            className={`${className}${downloading ? ' disabled-action' : ''}`}
            style={style}
        >
            {downloading && <span className="btn-spinner" />}
            {label}
            {downloading && progress?.percent != null && (
                <span className="btn-progress-track">
                    <span className="btn-progress-fill" style={{ width: `${progress.percent}%` }} />
                </span>
            )}
        </As>
    );
};

export default DownloadButton;

import { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

/*
 * Real-time progress needs the actual network transfer to be observable
 * from the page, which only a programmatic fetch (not a browser
 * navigation) gives you — axios's onDownloadProgress fires as bytes
 * genuinely arrive, so the live percentage/byte count shown here is real,
 * not simulated.
 *
 * What this deliberately does NOT do: claim the file is "downloaded" once
 * the fetch resolves. The blob-to-disk save that follows (triggered via a
 * throwaway <a download> click) is the browser's own native step and its
 * completion is invisible to any webpage's JavaScript — claiming success
 * at that point would be asserting something we can't actually verify. So
 * the button just goes quiet (back to idle) once the transfer finishes
 * and the save has been handed off, rather than showing a false "done".
 */
const parseFilename = (disposition, fallback) => {
    if (!disposition) return fallback;
    const match = disposition.match(/filename="?([^";]+)"?/);
    return match ? match[1] : fallback;
};

const formatBytes = (n) => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const readErrorMessage = async (err, fallback) => {
    const data = err.response?.data;
    if (data instanceof Blob) {
        try {
            const parsed = JSON.parse(await data.text());
            return parsed.message || fallback;
        } catch {
            return fallback;
        }
    }
    return data?.message || fallback;
};

export const useFileDownload = (authHeader) => {
    const [downloading, setDownloading] = useState(false);
    const [progress, setProgress] = useState(null); // { percent, label }

    // url: origin (e.g. http://localhost:3000); path: the download route,
    // e.g. `/api/finance/projects/${id}/advance-receipt/download`.
    // fallbackFilename: used only if the response has no Content-Disposition
    // (all current endpoints send one, this is just a safety net).
    // query (optional): extra params the route needs (e.g. ?month=).
    const run = async (url, path, fallbackFilename, query = {}, errorMessage = 'Error downloading file') => {
        setDownloading(true);
        setProgress({ percent: null, label: 'Starting…' });
        try {
            const res = await axios.get(`${url}${path}`, {
                ...authHeader,
                params: query,
                responseType: 'blob',
                onDownloadProgress: (evt) => {
                    const percent = evt.total ? Math.round((evt.loaded / evt.total) * 100) : null;
                    setProgress({ percent, label: percent != null ? `${percent}%` : formatBytes(evt.loaded) });
                }
            });
            const filename = parseFilename(res.headers['content-disposition'], fallbackFilename);
            const blobUrl = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            return true;
        } catch (err) {
            toast.error(await readErrorMessage(err, errorMessage));
            return false;
        } finally {
            setDownloading(false);
            setProgress(null);
        }
    };

    return { downloading, progress, run };
};

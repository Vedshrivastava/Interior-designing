import React from 'react';

/*
 * Repeatable {file, note} rows for attaching supporting documents (ID
 * proof, agreement, GST cert, etc.) to a Labourer or Contractor at
 * creation time — each file carries its own note saying what it's for,
 * since a bare file list gives no context later. `lines` is an array of
 * { file: File|null, note: string }; the parent owns the state and passes
 * it back down, same controlled-list pattern as Material Used lines.
 */
const DocumentUploadList = ({ lines, onChange }) => {
    const setLine = (idx, key, value) => onChange(lines.map((l, i) => (i === idx ? { ...l, [key]: value } : l)));
    const addLine = () => onChange([...lines, { file: null, note: '' }]);
    const removeLine = (idx) => onChange(lines.filter((_, i) => i !== idx));

    return (
        <div className="add-product-name flex-col">
            <p>Documents</p>
            <div className="contractor-assign-box">
                {lines.map((line, idx) => (
                    <div key={idx} className="contractor-assign-row">
                        <div className="contractor-assign-picker">
                            <input type="file" onChange={e => setLine(idx, 'file', e.target.files[0] || null)} />
                        </div>
                        <div className="contractor-assign-notes">
                            <input type="text" placeholder="What is this document? (e.g. Aadhar Card)" value={line.note}
                                onChange={e => setLine(idx, 'note', e.target.value)} />
                        </div>
                        <button type="button" className="contractor-assign-remove" aria-label="Remove document row" onClick={() => removeLine(idx)}>×</button>
                    </div>
                ))}
                <div className="contractor-assign-footer">
                    <button type="button" className="add-point-btn" onClick={addLine}>+ Add Document</button>
                </div>
            </div>
        </div>
    );
};

export default DocumentUploadList;

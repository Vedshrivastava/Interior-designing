import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import '../styles/add.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../index.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

const SUBCATEGORIES = {
    'Interior':               ['Ceilings', 'Wall Features', 'Flooring', 'Lighting', 'Furniture'],
    'Exterior':               ['Facades', 'Cladding', 'Landscaping', 'Pergolas'],
    'Functional Architecture':['Breeze Blocks', 'Jaali Walls', 'Decorative Screens', 'Feature Walls', 'Privacy Screens'],
};
const CATEGORIES = Object.keys(SUBCATEGORIES);

const FALLBACK_SPECIALITIES = [
    'Waterproof', 'UV Protection', 'Fire Resistant', 'Weather Resistant',
    'Eco-Friendly', 'Low Maintenance', 'Anti-Fungal', 'Sound Insulation',
    'Thermal Insulation', 'Scratch Resistant', 'Fade Resistant',
    'Customizable', 'Non-Toxic', 'Rust Resistant',
];

// Available icons for the picker
const ICON_POOL = [
  // Water / Moisture
  { key:'droplet',       fa:'fa-droplet',              label:'Water',        kw:['water','wet','moisture','waterproof','liquid','damp','humid','flood','rain','drip'] },
  { key:'umbrella',      fa:'fa-umbrella',             label:'Umbrella',     kw:['rain','water','wet','weather','protection','resistant'] },
  { key:'tint-slash',    fa:'fa-droplet-slash',        label:'Dry',          kw:['dry','moisture','waterproof','resistant','anti'] },
  // Fire / Heat
  { key:'fire',          fa:'fa-fire',                 label:'Fire',         kw:['fire','flame','heat','burn','resistant','hot','thermal','flammable'] },
  { key:'fire-extinguisher',fa:'fa-fire-extinguisher', label:'Extinguish',   kw:['fire','safety','resistant','extinguish','protect'] },
  // Sun / UV / Light
  { key:'sun',           fa:'fa-sun',                  label:'Sun/UV',       kw:['sun','uv','ultraviolet','light','fade','resistant','solar','bright','outdoor'] },
  { key:'radiation',     fa:'fa-radiation',            label:'Radiation',    kw:['uv','radiation','resist','nuclear','solar'] },
  // Temperature
  { key:'thermometer',   fa:'fa-temperature-half',     label:'Temp',         kw:['temperature','thermal','heat','cold','insulation','warm','cool','freeze'] },
  { key:'snowflake',     fa:'fa-snowflake',            label:'Cold',         kw:['cold','freeze','frost','ice','thermal','insulation','temperature','cool'] },
  // Weather / Cloud
  { key:'cloud',         fa:'fa-cloud',                label:'Cloud',        kw:['weather','cloud','rain','outdoor','resistant','climate'] },
  { key:'wind',          fa:'fa-wind',                 label:'Wind',         kw:['wind','weather','outdoor','resistant','air','ventilation'] },
  // Eco / Nature
  { key:'leaf',          fa:'fa-leaf',                 label:'Eco',          kw:['eco','green','nature','environment','sustainable','organic','natural','friendly','plant','bio'] },
  { key:'seedling',      fa:'fa-seedling',             label:'Seedling',     kw:['eco','green','grow','plant','natural','sustainable','organic'] },
  { key:'recycle',       fa:'fa-recycle',              label:'Recycle',      kw:['recycle','eco','sustainable','green','reuse','environment','friendly'] },
  { key:'globe',         fa:'fa-globe',                label:'Global',       kw:['eco','global','environment','sustainable','world','green'] },
  // Shield / Safety / Protection
  { key:'shield',        fa:'fa-shield',               label:'Shield',       kw:['protect','shield','safety','secure','resistant','anti','guard','defense','proof'] },
  { key:'shield-halved', fa:'fa-shield-halved',        label:'Protected',    kw:['protect','safety','resistant','anti','guard','secure','proof'] },
  { key:'lock',          fa:'fa-lock',                 label:'Lock',         kw:['secure','lock','safety','tamper','anti','proof','resistant'] },
  { key:'user-shield',   fa:'fa-user-shield',          label:'User Safety',  kw:['safety','protect','user','secure','guard'] },
  { key:'hard-hat',      fa:'fa-helmet-safety',        label:'Safety',       kw:['safety','helmet','protection','industrial','construction'] },
  // Sound / Noise
  { key:'volume-off',    fa:'fa-volume-xmark',         label:'Silent',       kw:['sound','noise','acoustic','silent','insulation','mute','quiet','vibration'] },
  { key:'ear-deaf',      fa:'fa-ear-deaf',             label:'Soundproof',   kw:['sound','noise','acoustic','deaf','insulation','quiet','silent'] },
  // Anti-fungal / Bio
  { key:'virus-slash',   fa:'fa-virus-slash',          label:'Anti-viral',   kw:['anti','fungal','viral','bacteria','germ','microbe','bio','mold','mildew'] },
  { key:'bacteria',      fa:'fa-bacteria',             label:'Bacteria',     kw:['bacteria','fungal','anti','germ','microbe','bio','mold'] },
  { key:'biohazard',     fa:'fa-biohazard',            label:'Biohazard',    kw:['bio','toxic','hazard','chemical','anti','fungi'] },
  // Scratch / Durability
  { key:'hammer',        fa:'fa-hammer',               label:'Durable',      kw:['scratch','durable','tough','strong','resistant','hard','solid','impact'] },
  { key:'cubes',         fa:'fa-cubes',                label:'Solid',        kw:['solid','durable','strong','material','robust','tough','impact'] },
  { key:'layer-group',   fa:'fa-layer-group',          label:'Layers',       kw:['layer','durable','multi','composite','thick','solid','laminate'] },
  // Rust / Corrosion
  { key:'rust',          fa:'fa-circle-exclamation',   label:'Anti-Rust',    kw:['rust','corrosion','oxidation','metal','anti','resistant','steel'] },
  { key:'wrench',        fa:'fa-screwdriver-wrench',   label:'Maintenance',  kw:['maintenance','repair','service','low','easy','wrench','fix'] },
  { key:'gear',          fa:'fa-gear',                 label:'Settings',     kw:['maintenance','service','mechanism','gear','function','low'] },
  { key:'gears',         fa:'fa-gears',                label:'Gears',        kw:['maintenance','system','mechanism','service','function'] },
  // Customizable / Design
  { key:'pen',           fa:'fa-pen',                  label:'Custom',       kw:['custom','design','flexible','adapt','pen','personalise','change'] },
  { key:'wand',          fa:'fa-wand-magic-sparkles',  label:'Magic',        kw:['custom','design','unique','special','magic','personalise'] },
  { key:'palette',       fa:'fa-palette',              label:'Colour',       kw:['colour','color','custom','design','paint','aesthetic','decor'] },
  { key:'paint-roller',  fa:'fa-paint-roller',         label:'Paintable',    kw:['paint','colour','custom','finish','coat','surface'] },
  { key:'brush',         fa:'fa-brush',                label:'Brush',        kw:['paint','finish','coat','custom','colour','surface'] },
  // Non-toxic / Chemical
  { key:'flask',         fa:'fa-flask',                label:'Chemical',     kw:['chemical','non-toxic','safe','material','lab','compound','solvent'] },
  { key:'vial',          fa:'fa-vial-circle-check',    label:'Safe',         kw:['non-toxic','safe','chemical','test','approved','lab'] },
  { key:'atom',          fa:'fa-atom',                 label:'Atomic',       kw:['chemical','material','compound','nano','molecular','anti'] },
  // Lightweight / Weight
  { key:'feather',       fa:'fa-feather',              label:'Light',        kw:['lightweight','light','weight','easy','portable','thin','slim'] },
  { key:'weight',        fa:'fa-weight-hanging',       label:'Heavy',        kw:['heavy','weight','strong','dense','solid','durable'] },
  // Electric / Static
  { key:'bolt',          fa:'fa-bolt',                 label:'Electric',     kw:['electric','static','anti','lightning','charge','power','energy','current'] },
  { key:'plug',          fa:'fa-plug',                 label:'Plug',         kw:['electric','power','plug','current','static','anti','charge'] },
  { key:'microchip',     fa:'fa-microchip',            label:'Tech',         kw:['tech','electronic','static','chip','smart','digital','anti'] },
  // General Positive / Quality
  { key:'check',         fa:'fa-check',                label:'Check',        kw:['check','approve','certified','quality','good','pass','yes','standard'] },
  { key:'circle-check',  fa:'fa-circle-check',         label:'Certified',    kw:['certified','approved','quality','standard','check','safe','tested'] },
  { key:'medal',         fa:'fa-medal',                label:'Medal',        kw:['quality','award','premium','best','top','medal','certified','standard'] },
  { key:'certificate',   fa:'fa-certificate',          label:'Certified',    kw:['certified','approved','standard','quality','official','tested'] },
  { key:'star',          fa:'fa-star',                 label:'Star',         kw:['quality','premium','best','top','star','excellent','superior'] },
  { key:'gem',           fa:'fa-gem',                  label:'Premium',      kw:['premium','luxury','gem','quality','superior','finest','exclusive'] },
  { key:'crown',         fa:'fa-crown',                label:'Top',          kw:['top','premium','best','quality','crown','luxury','superior'] },
  { key:'trophy',        fa:'fa-trophy',               label:'Trophy',       kw:['award','best','quality','top','winner','premium','excellence'] },
  // Eye / Visibility
  { key:'eye',           fa:'fa-eye',                  label:'Visible',      kw:['visible','eye','see','transparent','clear','view','anti-fade'] },
  { key:'eye-slash',     fa:'fa-eye-slash',            label:'Private',      kw:['anti','privacy','opaque','hide','block','uv','tint'] },
  // Compress / Expand / Flexibility
  { key:'compress',      fa:'fa-compress',             label:'Compact',      kw:['compact','flexible','compress','fold','small','fit'] },
  { key:'expand',        fa:'fa-expand',               label:'Expandable',   kw:['expand','flexible','large','adaptable','stretch','size'] },
  { key:'arrows-rotate', fa:'fa-arrows-rotate',        label:'Flexible',     kw:['flexible','rotation','reversible','custom','change','adapt'] },
  // Heat / Thermal Specific
  { key:'fire-flame',    fa:'fa-fire-flame-curved',    label:'Flame',        kw:['flame','fire','heat','thermal','resistant','hot','burn'] },
  { key:'temperature-arrow-up', fa:'fa-temperature-arrow-up', label:'Heating', kw:['heat','thermal','temperature','warm','insulation','efficient'] },
  { key:'temperature-arrow-down', fa:'fa-temperature-arrow-down', label:'Cooling', kw:['cool','cold','thermal','temperature','insulation','freeze'] },
  // Magnetic
  { key:'magnet',        fa:'fa-magnet',               label:'Magnet',       kw:['magnetic','anti','attract','metal','steel','force'] },
  // Time / Long-lasting
  { key:'clock',         fa:'fa-clock',                label:'Long-lasting', kw:['long','lasting','durable','time','permanent','lifetime','warranty'] },
  { key:'hourglass',     fa:'fa-hourglass-half',       label:'Durable',      kw:['time','durable','lasting','long','permanent','lifespan'] },
  { key:'infinity',      fa:'fa-infinity',             label:'Infinite',     kw:['infinite','long','lasting','permanent','eternal','maintenance'] },
  // Light / Illumination
  { key:'lightbulb',     fa:'fa-lightbulb',            label:'Light',        kw:['light','bright','energy','efficient','illumination','luminous','glow'] },
  { key:'sun-plant-wilt',fa:'fa-sun-plant-wilt',       label:'UV Proof',     kw:['uv','sun','fade','resistant','outdoor','solar','proof'] },
  // Surfaces / Materials
  { key:'cube',          fa:'fa-cube',                 label:'Block',        kw:['solid','block','cube','material','durable','structural'] },
  { key:'ruler',         fa:'fa-ruler',                label:'Precision',    kw:['precision','measure','accurate','fit','size','custom','cut'] },
  { key:'ruler-combined',fa:'fa-ruler-combined',       label:'Measure',      kw:['measure','precision','accurate','design','plan','size'] },
  // Odour / Air
  { key:'wind-free',     fa:'fa-wind',                 label:'Ventilation',  kw:['air','ventilation','breathable','odour','smell','fresh','circulation'] },
  { key:'mask',          fa:'fa-mask',                 label:'Anti-odour',   kw:['odour','smell','anti','toxic','mask','fume','chemical'] },
  // People / Friendly
  { key:'hand',          fa:'fa-hand',                 label:'Hand-safe',    kw:['safe','touch','friendly','non-toxic','handle','easy'] },
  { key:'hand-holding-heart', fa:'fa-hand-holding-heart', label:'Care',      kw:['care','safe','friendly','health','eco','non-toxic'] },
  { key:'heart',         fa:'fa-heart',                label:'Health',       kw:['health','safe','friendly','care','non-toxic','organic'] },
  { key:'person-walking',fa:'fa-person-walking',       label:'Accessible',   kw:['accessible','slip','anti','safe','walk','easy','mobility'] },
  // Slip / Grip
  { key:'shoe-prints',   fa:'fa-shoe-prints',          label:'Anti-Slip',    kw:['slip','anti','grip','floor','traction','safe','walk','skid'] },
  // Brightness / Reflectivity
  { key:'moon',          fa:'fa-moon',                 label:'Anti-Glare',   kw:['glare','anti','reflect','light','dark','night','matte','dull'] },
  { key:'mirror',        fa:'fa-mirror',               label:'Reflective',   kw:['reflect','mirror','surface','glare','shine','polish'] },
  // Structural
  { key:'building',      fa:'fa-building',             label:'Structural',   kw:['structural','building','architecture','construction','wall','facade'] },
  { key:'archway',       fa:'fa-archway',              label:'Arch',         kw:['arch','structural','wall','facade','design','architecture'] },
  // Pest
  { key:'bug-slash',     fa:'fa-bug-slash',            label:'Anti-Pest',    kw:['pest','anti','bug','insect','rodent','termite','proof'] },
  { key:'bug',           fa:'fa-bug',                  label:'Bug',          kw:['pest','bug','anti','insect','termite','resistant'] },
  // Allergy / Hypo
  { key:'face-grin',     fa:'fa-face-smile',           label:'Hypo-allergenic', kw:['allergy','hypo','safe','sensitive','non-toxic','friendly','allergic'] },
  // Industry
  { key:'industry',      fa:'fa-industry',             label:'Industrial',   kw:['industrial','heavy','factory','commercial','durable','strong'] },
  { key:'truck',         fa:'fa-truck',                label:'Heavy Duty',   kw:['heavy','duty','industrial','durable','strong','commercial','robust'] },
  // Flex / Bend
  { key:'arrows-alt',    fa:'fa-up-down-left-right',   label:'Flexible',     kw:['flexible','bend','adapt','move','direction','custom','versatile'] },
  // Award / Approved
  { key:'check-double',  fa:'fa-check-double',         label:'Double Check', kw:['approved','certified','double','quality','standard','tested','checked'] },
  { key:'clipboard-check', fa:'fa-clipboard-check',    label:'Tested',       kw:['tested','approved','quality','standard','certified','checked','passed'] },
  // Tag / Label
  { key:'tag',           fa:'fa-tag',                  label:'Tag',          kw:['tag','label','brand','mark','certified','rated','grade'] },
  // Money / Value
  { key:'money-bill',    fa:'fa-money-bill',           label:'Value',        kw:['value','cost','price','affordable','economic','budget','cheap'] },
  // Repair / Fix
  { key:'rotate',        fa:'fa-rotate',               label:'Reversible',   kw:['reversible','repair','restore','fix','undo','reset','change'] },
  // Dimension
  { key:'maximize',      fa:'fa-maximize',             label:'Wide',         kw:['wide','large','expand','size','dimension','big','spacious'] },
];

const COLOR_OPTIONS = [
    '#3b82f6', '#f59e0b', '#ef4444', '#6366f1', '#22c55e',
    '#8b5cf6', '#14b8a6', '#ec4899', '#f97316', '#64748b',
    '#a78bfa', '#c9a87c', '#10b981', '#78716c', '#0ea5e9',
    '#dc2626', '#16a34a', '#9333ea', '#0891b2', '#d97706',
];

// Backwards-compat alias — still used in a few places
const ICON_OPTIONS = ICON_POOL;

const APPLICATIONS = [
    'Residential', 'Commercial', 'Hospitality', 'Office',
    'Retail', 'Healthcare', 'Outdoor', 'Garden',
    'Rooftop', 'Balcony', 'Industrial', 'Education',
];

const AddProduct = ({ url, setIsLoading, isLoading }) => {
    const [images, setImages] = useState([]);
    const [data, setData] = useState({
        name:         '',
        description:  '',
        categories:   [],
        subcategory:  '',
        material:     '',
        finish:       '',
        specialities: [],
        applications: [],
        isFeatured:   false,
    });
    const [points, setPoints] = useState(['']);

    const [subCatOpen, setSubCatOpen] = useState(false);
    const subCatRef = useRef(null);

    // ── Specialities (DB-driven) ──
    const [specialityObjects, setSpecialityObjects] = useState([]);
    const [addingSpec,   setAddingSpec]   = useState(false);
    const [newSpecName,  setNewSpecName]  = useState('');
    const [newSpecIcon,  setNewSpecIcon]  = useState('check');
    const [iconSearch,   setIconSearch]   = useState('');
    const [newSpecColor, setNewSpecColor] = useState('#c9a87c');
    const [specSaving,   setSpecSaving]   = useState(false);
    const [confirmSpec,  setConfirmSpec]  = useState(null);
    const [specDeleting, setSpecDeleting] = useState(false);

    const token = localStorage.getItem('token');

    // Merge subcategories from all selected categories
    const availableSubcats = data.categories.length > 0
        ? [...new Set(data.categories.flatMap(cat => SUBCATEGORIES[cat] || []))]
        : [];

    useEffect(() => {
        const handler = (e) => {
            if (subCatRef.current && !subCatRef.current.contains(e.target)) setSubCatOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const fetchSpecialities = async () => {
        try {
            const res = await axios.get(`${url}/api/speciality/list`);
            if (res.data.success) setSpecialityObjects(res.data.data);
        } catch { setSpecialityObjects(FALLBACK_SPECIALITIES.map((n, i) => ({ _id: n, name: n, icon: 'check', color: '#c9a87c', order: i }))); }
    };
    useEffect(() => { fetchSpecialities(); }, []);

    const saveNewSpec = async () => {
        if (!newSpecName.trim()) { toast.error('Name is required'); return; }
        setSpecSaving(true);
        try {
            const res = await axios.post(`${url}/api/speciality/add`,
                { name: newSpecName.trim(), icon: newSpecIcon, color: newSpecColor },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                toast.success(res.data.message);
                setNewSpecName(''); setNewSpecIcon('check'); setNewSpecColor('#c9a87c');
                setAddingSpec(false);
                await fetchSpecialities();
            } else { toast.error(res.data.message); }
        } catch { toast.error('Failed to add speciality'); }
        finally { setSpecSaving(false); }
    };

    const confirmDeleteSpec = async () => {
        if (!confirmSpec || specDeleting) return;
        setSpecDeleting(true);
        try {
            const res = await axios.post(`${url}/api/speciality/remove`,
                { _id: confirmSpec._id },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                toast.success(res.data.message);
                setData(p => ({ ...p, specialities: p.specialities.filter(s => s !== confirmSpec.name) }));
                setConfirmSpec(null);
                await fetchSpecialities();
            } else { toast.error(res.data.message); }
        } catch { toast.error('Failed to remove'); }
        finally { setSpecDeleting(false); }
    };

    const toggleCategory = (cat) => {
        setData(prev => {
            const next = prev.categories.includes(cat)
                ? prev.categories.filter(c => c !== cat)
                : [...prev.categories, cat];
            // Reset subcategory if it no longer belongs to selected cats
            const nextSubcats = [...new Set(next.flatMap(c => SUBCATEGORIES[c] || []))];
            return {
                ...prev,
                categories: next,
                subcategory: nextSubcats.includes(prev.subcategory) ? prev.subcategory : (nextSubcats[0] || ''),
            };
        });
    };

    const onChange = (e) => {
        const { name, value, type, checked } = e.target;
        setData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const toggleChip = (field, val) => {
        setData(prev => ({
            ...prev,
            [field]: prev[field].includes(val)
                ? prev[field].filter(v => v !== val)
                : [...prev[field], val],
        }));
    };

    const onPointChange  = (i, v) => { const p = [...points]; p[i] = v; setPoints(p); };
    const addPoint       = ()     => setPoints([...points, '']);
    const removePoint    = (i)    => setPoints(points.filter((_, idx) => idx !== i));
    const onImageChange  = (e)    => setImages(prev => [...prev, ...Array.from(e.target.files)]);
    const removeImage    = (i)    => setImages(images.filter((_, idx) => idx !== i));

    const onSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        const fd = new FormData();
        fd.append('name',         data.name);
        fd.append('description',  data.description);
        fd.append('categories',   JSON.stringify(data.categories));
        fd.append('subcategory',  data.subcategory);
        fd.append('material',     data.material);
        fd.append('finish',       data.finish);
        fd.append('specialities', JSON.stringify(data.specialities));
        fd.append('applications', JSON.stringify(data.applications));
        fd.append('points',       JSON.stringify(points.filter(p => p.trim())));
        fd.append('isFeatured',   data.isFeatured);
        images.forEach(img => fd.append('images', img));

        try {
            const res = await axios.post(`${url}/api/product/add`, fd, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) {
                setData({
                    name: '', description: '', categories: [], subcategory: '',
                    material: '', finish: '', specialities: [], applications: [], isFeatured: false,
                });
                setPoints(['']);
                setImages([]);
                toast.success(res.data.message);
            } else {
                toast.error(res.data.message);
            }
        } catch {
            toast.error('An error occurred while adding the product.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
        <div className="add">
            <form className="flex-col" onSubmit={onSubmit}>

                {/* ── Images ── */}
                <div className="add-img-upload flex-col">
                    <h2>Product Images</h2>
                    <label htmlFor="prod-image" className="upload-icon">
                        <i className="fa fa-upload" />
                    </label>
                    <input onChange={onImageChange} type="file" id="prod-image" multiple hidden />
                    <div className="selected-images">
                        {images.map((img, i) => (
                            <div key={i} className="image-preview">
                                <img src={URL.createObjectURL(img)} alt={`img-${i}`} className="thumbnail" />
                                <button type="button" onClick={() => removeImage(i)} className="remove-btn">X</button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Name ── */}
                <div className="add-product-name flex-col">
                    <h2>Product Name</h2>
                    <input name="name" value={data.name} onChange={onChange} type="text" placeholder="e.g. Concrete Breeze Block Panel" required />
                </div>

                {/* ── Description ── */}
                <div className="add-product-description flex-col">
                    <h2>Description</h2>
                    <textarea name="description" value={data.description} onChange={onChange} rows="5" placeholder="Describe the product — its look, function, and unique qualities…" required />
                </div>

                {/* ── Categories (multi-select) ── */}
                <div className="add-multi-section flex-col">
                    <h2>Categories <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#888' }}>(select all that apply)</span></h2>
                    <div className="add-multi-grid">
                        {CATEGORIES.map(cat => (
                            <button key={cat} type="button"
                                className={`add-multi-chip${data.categories.includes(cat) ? ' active' : ''}`}
                                onClick={() => toggleCategory(cat)}>
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Subcategory ── */}
                {availableSubcats.length > 0 && (
                    <div className="add-cat-dropdown-wrap flex-col">
                        <h2>Subcategory</h2>
                        <div className="add-cat-dropdown" ref={subCatRef}>
                            <button type="button" className={`add-cat-trigger${subCatOpen ? ' open' : ''}`} onClick={() => setSubCatOpen(o => !o)}>
                                <span>{data.subcategory || 'Select subcategory'}</span>
                                <i className="fa fa-chevron-down" />
                            </button>
                            {subCatOpen && (
                                <ul className="add-cat-list">
                                    {availableSubcats.map((sub, i) => (
                                        <li key={i} className={`add-cat-option${data.subcategory === sub ? ' active' : ''}`}
                                            onClick={() => { setData(prev => ({ ...prev, subcategory: sub })); setSubCatOpen(false); }}>
                                            <span>{sub}</span>
                                            {data.subcategory === sub && <i className="fa fa-check" />}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Material + Finish ── */}
                <div className="add-category-price">
                    <div className="add-category flex-col">
                        <h2>Material</h2>
                        <input name="material" value={data.material} onChange={onChange} type="text" placeholder="e.g. Concrete, Teak Wood, Mild Steel" />
                    </div>
                    <div className="add-category flex-col">
                        <h2>Finish</h2>
                        <input name="finish" value={data.finish} onChange={onChange} type="text" placeholder="e.g. Matte, Polished, Rough Cast" />
                    </div>
                </div>

                {/* ── Specialities ── */}
                <div className="add-multi-section flex-col">
                    <h2>Specialities</h2>
                    <div className="add-multi-grid">
                        {specialityObjects.map(spec => {
                            const icon = ICON_OPTIONS.find(i => i.key === spec.icon);
                            const selected = data.specialities.includes(spec.name);
                            return (
                                <div key={spec._id} className="spec-chip-wrap">
                                    <button type="button"
                                        className={`add-multi-chip spec-chip${selected ? ' active' : ''}`}
                                        style={selected ? { background: `${spec.color}22`, borderColor: `${spec.color}88`, color: spec.color } : {}}
                                        onClick={() => toggleChip('specialities', spec.name)}>
                                        {icon && <i className={`fa-solid ${icon.fa}`} style={{ color: selected ? spec.color : undefined }} />}
                                        {spec.name}
                                    </button>
                                    <button type="button" className="spec-trash-btn"
                                        title={`Remove "${spec.name}"`}
                                        onClick={() => setConfirmSpec(spec)}>
                                        <i className="fa-solid fa-trash" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Add new speciality */}
                    {!addingSpec ? (
                        <button type="button" className="add-point-btn" style={{ marginTop: '10px' }} onClick={() => { setAddingSpec(true); setIconSearch(''); }}>
                            <i className="fa fa-plus" /> Add new speciality
                        </button>
                    ) : (
                        <div className="spec-add-form">
                            <input
                                type="text" placeholder="Speciality name e.g. Anti-Static"
                                value={newSpecName} onChange={e => setNewSpecName(e.target.value)}
                                autoFocus
                            />
                            <p className="spec-form-label">Pick an icon</p>

                            {/* Search bar */}
                            <div className="spec-icon-search-wrap">
                                <i className="fa-solid fa-magnifying-glass" />
                                <input
                                    type="text"
                                    placeholder="Search icons… e.g. water, fire, eco"
                                    value={iconSearch}
                                    onChange={e => setIconSearch(e.target.value)}
                                />
                                {iconSearch && <button type="button" className="spec-icon-search-clear" onClick={() => setIconSearch('')}>×</button>}
                            </div>

                            {/* Smart suggestions based on name */}
                            {(() => {
                                const nameWords = newSpecName.toLowerCase().split(/\s+|-/).filter(Boolean);
                                const suggestions = nameWords.length > 0
                                    ? ICON_POOL
                                        .map(opt => ({ ...opt, score: opt.kw.reduce((s, kw) => s + (nameWords.some(w => kw.includes(w) || w.includes(kw)) ? 1 : 0), 0) }))
                                        .filter(opt => opt.score > 0)
                                        .sort((a, b) => b.score - a.score)
                                        .slice(0, 8)
                                    : [];
                                return suggestions.length > 0 && !iconSearch ? (
                                    <div>
                                        <p className="spec-form-label" style={{ color: 'var(--gold)', marginBottom: '6px' }}>
                                            <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: '5px' }} />
                                            Suggested for "{newSpecName}"
                                        </p>
                                        <div className="spec-icon-grid spec-icon-grid--suggestions">
                                            {suggestions.map(opt => (
                                                <button key={opt.key} type="button"
                                                    className={`spec-icon-btn${newSpecIcon === opt.key ? ' active' : ''}`}
                                                    title={opt.label}
                                                    onClick={() => setNewSpecIcon(opt.key)}>
                                                    <i className={`fa-solid ${opt.fa}`} />
                                                    <span>{opt.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : null;
                            })()}

                            {/* Full icon grid (filtered by search) */}
                            <div className="spec-icon-grid-wrap">
                                <div className="spec-icon-grid spec-icon-grid--full">
                                    {ICON_POOL
                                        .filter(opt => !iconSearch || opt.label.toLowerCase().includes(iconSearch.toLowerCase()) || opt.kw.some(k => k.includes(iconSearch.toLowerCase())))
                                        .map(opt => (
                                            <button key={opt.key} type="button"
                                                className={`spec-icon-btn${newSpecIcon === opt.key ? ' active' : ''}`}
                                                title={opt.label}
                                                onClick={() => setNewSpecIcon(opt.key)}>
                                                <i className={`fa-solid ${opt.fa}`} />
                                                <span>{opt.label}</span>
                                            </button>
                                        ))
                                    }
                                </div>
                            </div>
                            <p className="spec-form-label">Pick a colour</p>
                            <div className="spec-color-row">
                                {COLOR_OPTIONS.map(c => (
                                    <button key={c} type="button"
                                        className={`spec-color-swatch${newSpecColor === c ? ' active' : ''}`}
                                        style={{ background: c }}
                                        onClick={() => setNewSpecColor(c)} />
                                ))}
                            </div>
                            {/* Preview */}
                            <div className="spec-preview">
                                Preview: <span className="spec-preview-badge" style={{ background: `${newSpecColor}22`, borderColor: `${newSpecColor}88`, color: newSpecColor }}>
                                    {ICON_OPTIONS.find(i => i.key === newSpecIcon) && <i className={`fa-solid ${ICON_OPTIONS.find(i => i.key === newSpecIcon).fa}`} />}
                                    {newSpecName || 'Name'}
                                </span>
                            </div>
                            <div className="add-cat-new-actions" style={{ marginTop: '10px' }}>
                                <button type="button" className="add-cat-save-btn" onClick={saveNewSpec} disabled={specSaving}>{specSaving ? 'Saving…' : 'Save'}</button>
                                <button type="button" className="add-cat-cancel-btn" onClick={() => { setAddingSpec(false); setNewSpecName(''); setNewSpecIcon('check'); setNewSpecColor('#c9a87c'); setIconSearch(''); }}>Cancel</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Applications ── */}
                <div className="add-multi-section flex-col">
                    <h2>Applications</h2>
                    <div className="add-multi-grid">
                        {APPLICATIONS.map(app => (
                            <button key={app} type="button"
                                className={`add-multi-chip${data.applications.includes(app) ? ' active' : ''}`}
                                onClick={() => toggleChip('applications', app)}>
                                {app}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Key Highlights ── */}
                <div className="add-product-points flex-col">
                    <h2>Key Highlights</h2>
                    {points.map((pt, i) => (
                        <div key={i} className="point-input">
                            <input type="text" value={pt} onChange={e => onPointChange(i, e.target.value)} placeholder={`Highlight ${i + 1}`} />
                            <button type="button" onClick={() => removePoint(i)} className="remove-point-btn">Remove</button>
                        </div>
                    ))}
                    <button type="button" className="add-point-btn" onClick={addPoint}>+ Add Highlight</button>
                </div>

                {/* ── Featured card ── */}
                <label className={`add-feature-card${data.isFeatured ? ' active' : ''}`}>
                    <div className="add-feature-left">
                        <div className="add-feature-icon"><i className="fa fa-star" /></div>
                        <div className="add-feature-text">
                            <span className="add-feature-title">Feature on Products Page</span>
                            <span className="add-feature-desc">Mark as featured — this product will appear at the top of the products page.</span>
                        </div>
                    </div>
                    <input type="checkbox" name="isFeatured" checked={data.isFeatured} onChange={onChange} style={{ display: 'none' }} />
                    <span className="toggle-slider" />
                </label>

                <button type="submit" className="add-btn" disabled={isLoading}>
                    {isLoading ? 'Uploading…' : 'Add Product'}
                </button>

            </form>
        </div>

        {confirmSpec && ReactDOM.createPortal(
            <div className="bin-confirm-backdrop" onClick={() => !specDeleting && setConfirmSpec(null)}>
                <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                    <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                    <h3>Remove Speciality?</h3>
                    <p className="bin-confirm-name">"{confirmSpec.name}"</p>
                    <p className="bin-confirm-warning">Moved to Recovery Bin. Products using it are unaffected.</p>
                    <div className="bin-confirm-actions">
                        <button className="bin-btn-cancel" onClick={() => setConfirmSpec(null)} disabled={specDeleting}>Cancel</button>
                        <button className="bin-btn-delete" onClick={confirmDeleteSpec} disabled={specDeleting}>
                            {specDeleting ? <><i className="fa-solid fa-circle-notch fa-spin" /> Removing…</> : <><i className="fa-solid fa-trash" /> Yes, Remove</>}
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        )}
        </>
    );
};

export default AddProduct;

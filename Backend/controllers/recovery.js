import Design           from '../models/design.js';
import Product         from '../models/product.js';
import Project         from '../models/project.js';
import Category        from '../models/category.js';
import ProjectCategory from '../models/projectCategory.js';
import ProjectType     from '../models/projectType.js';
import { v2 as cloudinary } from 'cloudinary';
import { broadcast } from '../middlewares/webSocket.js';
import dotenv from 'dotenv';
dotenv.config();

const TYPE_BROADCAST = {
    design:            'designsChanged',
    product:           'productsChanged',
    project:           'projectsChanged',
    category:          'categoriesChanged',
    projectCategory:   'projectCategoriesChanged',
    projectType:       'projectTypesChanged',
};

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key:    process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
});

/* ── List all soft-deleted items across all 3 collections ── */
const listBin = async (req, res) => {
    try {
        const [designs, products, projects, categories, projectCategories, projectTypes] = await Promise.all([
            Design         .find({ deleted: true }).sort({ deletedAt: -1 }),
            Product        .find({ deleted: true }).sort({ deletedAt: -1 }),
            Project        .find({ deleted: true }).sort({ deletedAt: -1 }),
            Category       .find({ deleted: true }).sort({ deletedAt: -1 }),
            ProjectCategory.find({ deleted: true }).sort({ deletedAt: -1 }),
            ProjectType    .find({ deleted: true }).sort({ deletedAt: -1 }),
        ]);

        const categoryData = await Promise.all(
            categories.map(async cat => {
                const designCount = await Design.countDocuments({ category: cat.name, deleted: { $ne: true } });
                return { ...cat.toObject(), _type: 'category', designCount };
            })
        );

        const projectCategoryData = await Promise.all(
            projectCategories.map(async cat => {
                const projectCount = await Project.countDocuments({ category: cat.name, deleted: { $ne: true } });
                return { ...cat.toObject(), _type: 'projectCategory', projectCount };
            })
        );

        const projectTypeData = await Promise.all(
            projectTypes.map(async t => {
                const projectCount = await Project.countDocuments({ projectType: t.name, deleted: { $ne: true } });
                return { ...t.toObject(), _type: 'projectType', projectCount };
            })
        );

        return res.json({
            success: true,
            data: {
                designs:          designs .map(d => ({ ...d.toObject(), _type: 'design'   })),
                products:         products.map(p => ({ ...p.toObject(), _type: 'product'  })),
                projects:         projects.map(p => ({ ...p.toObject(), _type: 'project'  })),
                categories:       categoryData,
                projectCategories: projectCategoryData,
                projectTypes:     projectTypeData,
            },
        });
    } catch (error) {
        console.error('listBin error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

/* ── Restore a soft-deleted item ── */
const restoreItem = async (req, res) => {
    const { _id, _type } = req.body;
    try {
        const Model = _type === 'design' ? Design : _type === 'product' ? Product : _type === 'category' ? Category : _type === 'projectCategory' ? ProjectCategory : _type === 'projectType' ? ProjectType : Project;
        const item  = await Model.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });

        item.deleted   = false;
        item.deletedAt = undefined;
        item.deletedBy = undefined;
        await item.save();
        broadcast({ type: 'binChanged' });
        broadcast({ type: TYPE_BROADCAST[_type] });

        return res.json({ success: true, message: `"${item.name}" restored successfully.` });
    } catch (error) {
        console.error('restoreItem error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

/* ── Permanently delete an item + its Cloudinary images ── */
const permanentDelete = async (req, res) => {
    const { _id, _type } = req.body;
    try {
        const Model  = _type === 'design' ? Design : _type === 'product' ? Product : _type === 'category' ? Category : _type === 'projectCategory' ? ProjectCategory : _type === 'projectType' ? ProjectType : Project;
        const folder = _type === 'design' ? 'design_images' : _type === 'product' ? 'product_images' : _type === 'project' ? 'project_images' : null;

        const item = await Model.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });

        if (folder) {
            for (const url of item.images || []) {
                try {
                    const publicId = url.split('/').pop().split('.')[0];
                    await cloudinary.uploader.destroy(`${folder}/${publicId}`);
                } catch (err) {
                    console.error('Cloudinary delete error:', err);
                }
            }
        }

        await Model.findByIdAndDelete(_id);
        broadcast({ type: 'binChanged' });
        broadcast({ type: TYPE_BROADCAST[_type] });

        return res.json({ success: true, message: `"${item.name}" permanently deleted.` });
    } catch (error) {
        console.error('permanentDelete error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

export { listBin, restoreItem, permanentDelete };

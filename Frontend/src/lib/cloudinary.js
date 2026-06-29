export function cloudinaryOptimize(url, { width, crop = 'limit' } = {}) {
  if (!url || !url.includes('res.cloudinary.com')) return url;
  const transform = width
    ? `w_${width},c_${crop},f_auto,q_auto:good`
    : `f_auto,q_auto:good`;
  return url.replace('/upload/', `/upload/${transform}/`);
}

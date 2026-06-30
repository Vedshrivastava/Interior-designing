export async function getCloudinaryLQIP(url) {
  if (!url || !url.includes('res.cloudinary.com')) return null;
  try {
    const lqipUrl = url.replace('/upload/', '/upload/w_20,h_15,c_fill,f_jpg,q_10,e_blur:500/');
    const res = await fetch(lqipUrl, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    return `data:image/jpeg;base64,${Buffer.from(buffer).toString('base64')}`;
  } catch {
    return null;
  }
}

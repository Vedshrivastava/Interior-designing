import dotenv from 'dotenv';
dotenv.config();

const getGoogleReviews = async (req, res) => {
    const placeId = process.env.GOOGLE_PLACE_ID;
    const apiKey  = process.env.GOOGLE_PLACES_API_KEY;

    if (!placeId || !apiKey) {
        return res.json({ success: true, data: [], configured: false });
    }

    try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,url,name&key=${apiKey}&reviews_sort=newest`;
        const response = await fetch(url);
        const json     = await response.json();

        if (json.status !== 'OK') {
            console.error('Google Places API error:', json.status, json.error_message);
            return res.json({ success: true, data: [], configured: true, error: json.status });
        }

        const reviews = (json.result.reviews || []).map(r => ({
            name:       r.author_name,
            text:       r.text,
            rating:     r.rating,
            image:      r.profile_photo_url || '',
            location:   'Google Review',
            authorUrl:  r.author_url,
            reviewsUrl: json.result.url,
            isGoogle:   true,
            time:       r.relative_time_description,
        }));

        return res.json({ success: true, data: reviews, configured: true, reviewsUrl: json.result.url });
    } catch (error) {
        console.error('Google Reviews fetch error:', error);
        return res.json({ success: true, data: [], configured: true, error: 'fetch_failed' });
    }
};

export { getGoogleReviews };

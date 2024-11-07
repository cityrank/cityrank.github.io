// Initialize CloudKit
CloudKit.configure({
    containers: [{
        containerIdentifier: 'iCloud.com.mikita.mapapp',
        apiTokenAuth: { apiToken: '598d528768fec35ae10417d3313fd4ae6fc6c65907a2e2e7bf88491f0eff9d0a', persist: true },
        environment: 'production'
    }]
});

// Initialize Mapbox
mapboxgl.accessToken = 'pk.eyJ1IjoibWlraXRrbzEiLCJhIjoiY20wemJxaDVzMDVheDJqczg0NnV3MG1jbyJ9.8MNS07csgIJkUXTGjZiaYA';
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [0, 0],
    zoom: 2,
    projection: 'globe'
});

// Define color codes based on rating for country polygons
const countryRatingColors = {
    5: '#2ecc71',
    4: '#27ae60',
    3: '#f1c40f',
    2: '#e67e22',
    1: '#e74c3c'
};

// Apply atmosphere settings
map.on('style.load', () => {
    console.log("Map style loaded");  // Confirm style load
    map.setFog({
        color: 'rgba(135, 206, 235, 0.5)',
        "high-color": 'rgba(70, 130, 180, 0.8)',
        "space-color": 'rgba(20, 24, 82, 1.0)',
        "horizon-blend": 0.1,
        "star-intensity": 0.1
    });

    map.setMinZoom(1.0);
    map.setMaxZoom(11.0);

    // Fetch and add polygons after style load
    fetchCountryRatings();
});

// Fetch country data and add polygons based on average rating
function fetchCountryRatings() {
    console.log("Fetching country ratings from CloudKit");
    CloudKit.getDefaultContainer().publicCloudDatabase.performQuery({
        recordType: 'CityComment'
    }).then(response => {
        if (response.hasErrors) {
            console.error('CloudKit query failed:', response.errors);
            return;
        }

        const countryRatings = {};
        response.records.forEach(record => {
            const country = record.fields.country?.value;
            const rating = record.fields.rating?.value;

            if (country && rating) {
                if (!countryRatings[country]) countryRatings[country] = [];
                countryRatings[country].push(rating);
            }
        });

        Object.keys(countryRatings).forEach(country => {
            const avgRating = calculateAverage(countryRatings[country]);
            console.log(`Adding polygon for ${country} with average rating ${avgRating}`);
            addCountryPolygon(country, avgRating);
        });
    }).catch(error => console.error('CloudKit query failed:', error));
}

// Calculate average rating
function calculateAverage(ratings) {
    const sum = ratings.reduce((a, b) => a + b, 0);
    return sum / ratings.length;
}

// Add polygon for a country based on rating
function addCountryPolygon(country, rating) {
    const color = countryRatingColors[Math.round(rating)] || '#3498db';

    // Define unique source and layer identifiers
    const sourceId = `${country}-boundary-source`;
    const layerId = `${country}-boundary-layer`;

    // Remove existing source and layer if they exist
    if (map.getSource(sourceId)) map.removeSource(sourceId);
    if (map.getLayer(layerId)) map.removeLayer(layerId);

    // Add the country boundaries vector source
    map.addSource(sourceId, {
        type: 'vector',
        url: 'mapbox://mapbox.country-boundaries-v1'
    });

    // Log after source addition
    if (map.getSource(sourceId)) {
        console.log(`Source added for ${country} with sourceId ${sourceId}`);
    } else {
        console.error(`Failed to add source for ${country}`);
    }

    // Attempt to add the polygon layer for the country
    try {
        map.addLayer({
            id: layerId,
            type: 'fill',
            source: sourceId,
            'source-layer': 'country_boundaries',  // Verify this matches the exact name in Mapbox Studio
            paint: {
                'fill-color': color,
                'fill-opacity': 0.5
            }
        });
        console.log(`Polygon layer added for ${country} with color ${color}`);
    } catch (error) {
        console.error(`Error adding polygon layer for ${country}:`, error);
    }
}

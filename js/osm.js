// OpenStreetMap data integration
const OSMManager = {
    osmSource: null,
    osmLayer: null,
    osmFeatures: [], // Cache of OSM features
    styleCache: {},
    compatibleTypesCache: {},
    ownershipCache: {
        claimedSet: new Set(),
        ownerColorById: {},
        fallbackColor: '#22c55e',
    },
    lastOwnershipRefresh: 0,
    ownershipRefreshIntervalMs: 500,
    pendingLoadTimers: [],
    activeFetchController: null,
    retryTimer: null,
    retryAttempts: 0,
    maxRetryAttempts: 5,
    retryBaseDelayMs: 1000,
    inFlightBboxKey: null,
    lastLoadedBboxKey: null,
    
    init: () => {
        // Vector source for OSM features
        OSMManager.osmSource = new ol.source.Vector();
        OSMManager.osmLayer = new ol.layer.Vector({
            source: OSMManager.osmSource,
            style: OSMManager.getOSMFeatureStyle,
            zIndex: 15, // Above everything else to be visible
        });
        
        // Add layer to map
        MapManager.map.addLayer(OSMManager.osmLayer);
        
        // Load OSM features for current view (which will also load known houses)
        // Use staggered attempts so slower machines still load reliably.
        OSMManager.scheduleLoadAttempts(true);
        
        // Reload when map moves significantly
        MapManager.map.on('moveend', OSMManager.onMapMove);
    },

    clearPendingLoadTimers: () => {
        if (OSMManager.pendingLoadTimers.length > 0) {
            OSMManager.pendingLoadTimers.forEach((timerId) => clearTimeout(timerId));
            OSMManager.pendingLoadTimers = [];
        }
    },

    scheduleLoadAttempts: (forceFirstAttempt = false) => {
        OSMManager.clearPendingLoadTimers();

        const delays = [150, 1200, 3200];
        delays.forEach((delay, idx) => {
            const timerId = setTimeout(() => {
                OSMManager.loadOSMFeatures(forceFirstAttempt && idx === 0);
            }, delay);
            OSMManager.pendingLoadTimers.push(timerId);
        });
    },

    scheduleRetry: () => {
        if (OSMManager.retryTimer || OSMManager.retryAttempts >= OSMManager.maxRetryAttempts) {
            return;
        }

        const delay = OSMManager.retryBaseDelayMs * Math.pow(2, OSMManager.retryAttempts);
        OSMManager.retryAttempts += 1;

        OSMManager.retryTimer = setTimeout(() => {
            OSMManager.retryTimer = null;
            OSMManager.loadOSMFeatures(true);
        }, delay);
    },

    resetRetryState: () => {
        OSMManager.retryAttempts = 0;
        if (OSMManager.retryTimer) {
            clearTimeout(OSMManager.retryTimer);
            OSMManager.retryTimer = null;
        }
    },
    
    onMapMove: () => {
        const zoom = MapManager.map.getView().getZoom();
        // Only load OSM features when zoomed in enough
        if (zoom >= 14) {
            OSMManager.scheduleLoadAttempts(false);
        } else {
            // Clear features when zoomed out
            OSMManager.clearPendingLoadTimers();
            OSMManager.resetRetryState();
            OSMManager.osmSource.clear();
            OSMManager.osmFeatures = [];
            OSMManager.lastLoadedBboxKey = null;
            OSMManager.inFlightBboxKey = null;
            if (OSMManager.activeFetchController) {
                OSMManager.activeFetchController.abort();
                OSMManager.activeFetchController = null;
            }
        }
    },

    getCurrentBboxKey: () => {
        const view = MapManager.map.getView();
        const mapSize = MapManager.map.getSize();
        if (!mapSize || mapSize[0] <= 0 || mapSize[1] <= 0) {
            return null;
        }

        const extent = view.calculateExtent(mapSize);
        const [minX, minY, maxX, maxY] = extent;

        // Convert to lat/lon
        const bottomLeft = ol.proj.toLonLat([minX, minY]);
        const topRight = ol.proj.toLonLat([maxX, maxY]);

        const minLat = bottomLeft[1];
        const minLon = bottomLeft[0];
        const maxLat = topRight[1];
        const maxLon = topRight[0];

        if (![minLat, minLon, maxLat, maxLon].every(Number.isFinite)) {
            return null;
        }

        const bbox = `${minLat},${minLon},${maxLat},${maxLon}`;
        const bboxKey = `${minLat.toFixed(4)},${minLon.toFixed(4)},${maxLat.toFixed(4)},${maxLon.toFixed(4)}`;

        return { bbox, bboxKey };
    },

    loadOSMFeatures: (forceReload = false) => {
        const view = MapManager.map.getView();
        const zoom = view.getZoom();
        
        // Only load when zoomed in
        if (zoom < 14) {
            return;
        }

        const bboxData = OSMManager.getCurrentBboxKey();
        if (!bboxData) {
            OSMManager.scheduleRetry();
            return;
        }

        const { bbox, bboxKey } = bboxData;
        if (!forceReload && OSMManager.lastLoadedBboxKey === bboxKey) {
            return;
        }
        if (!forceReload && OSMManager.inFlightBboxKey === bboxKey) {
            return;
        }
        
        // Load known houses first
        OSMManager.loadKnownHouses();
        
        // Overpass API query for buildings and amenities
        const query = `
            [out:json][timeout:25];
            (
                way["building"](${bbox});
                node["amenity"](${bbox});
                way["amenity"](${bbox});
                way["landuse"~"farm|farmland|meadow|forest|residential"](${bbox});
                node["shop"](${bbox});
                way["shop"](${bbox});
            );
            out geom;
        `;
        
        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

        if (OSMManager.activeFetchController) {
            OSMManager.activeFetchController.abort();
        }
        const controller = new AbortController();
        OSMManager.activeFetchController = controller;
        OSMManager.inFlightBboxKey = bboxKey;
        
        fetch(url, { signal: controller.signal })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Overpass request failed (${response.status})`);
                }
                return response.json();
            })
            .then(data => {
                if (OSMManager.activeFetchController !== controller) {
                    return;
                }
                OSMManager.processOSMData(data);
                OSMManager.lastLoadedBboxKey = bboxKey;
                OSMManager.resetRetryState();
            })
            .catch(error => {
                if (error && error.name === 'AbortError') {
                    return;
                }
                console.error('Error loading OSM data:', error);
                if (OSMManager.lastLoadedBboxKey === bboxKey) {
                    OSMManager.lastLoadedBboxKey = null;
                }
                OSMManager.scheduleRetry();
            })
            .finally(() => {
                if (OSMManager.inFlightBboxKey === bboxKey) {
                    OSMManager.inFlightBboxKey = null;
                }
                if (OSMManager.activeFetchController === controller) {
                    OSMManager.activeFetchController = null;
                }
            });
    },
    
    processOSMData: (data) => {
        // Clear only non-known-house features
        const knownHouseFeatures = OSMManager.osmSource.getFeatures().filter(f => {
            const osmData = f.get('osmData');
            return osmData && String(osmData.id).startsWith('known_');
        });
        
        OSMManager.osmSource.clear();
        OSMManager.osmFeatures = [];
        
        // Re-add known houses
        knownHouseFeatures.forEach(feature => {
            OSMManager.osmSource.addFeature(feature);
            const osmData = feature.get('osmData');
            OSMManager.osmFeatures.push({
                id: osmData.id,
                type: 'node',
                tags: osmData.tags,
                geometry: osmData,
                feature: feature,
                isKnownHouse: true,
            });
        });
        
        if (!data.elements) {
            return;
        }
        
        data.elements.forEach(element => {
            const feature = OSMManager.createFeatureFromElement(element);
            if (feature) {
                OSMManager.osmSource.addFeature(feature);
                OSMManager.osmFeatures.push({
                    id: element.id,
                    type: element.type,
                    tags: element.tags || {},
                    geometry: element,
                    feature: feature,
                });
            }
        });
    },
    
    loadKnownHouses: () => {
        // Add famous houses as features on the map, removing nearby OSM data
        if (!CONFIG.KNOWN_HOUSES || CONFIG.KNOWN_HOUSES.length === 0) {
            return; // No known houses defined
        }
        
        const view = MapManager.map.getView();
        const zoom = view.getZoom();
        
        // Only load when zoomed in
        if (zoom < 14) {
            return;
        }
        
        let housesAdded = 0;
        CONFIG.KNOWN_HOUSES.forEach(house => {
            try {
                // Check if the house is within the current map view
                const extent = view.calculateExtent(MapManager.map.getSize());
                const houseCoords = ol.proj.fromLonLat(house.location);
                const [minX, minY, maxX, maxY] = extent;
                
                if (houseCoords[0] >= minX && houseCoords[0] <= maxX &&
                    houseCoords[1] >= minY && houseCoords[1] <= maxY) {
                    
                    const houseId = 'known_' + house.name.replace(/\s+/g, '_');
                    
                    // Check if this known house is already in the source
                    const existingFeature = OSMManager.osmSource.getFeatureById(houseId);
                    if (existingFeature) {
                        return; // Already added
                    }
                    
                    // Remove any OSM features within 100 meters of this known house
                    // This prevents conflicts and ensures known houses take priority
                    const toleranceMeters = 100;
                    const featuresToRemove = [];
                    
                    OSMManager.osmSource.getFeatures().forEach(osmFeature => {
                        const osmGeometry = osmFeature.getGeometry();
                        if (osmGeometry && osmGeometry.getType() === 'Point') {
                            const dist = ol.sphere.getDistance(house.location, 
                                ol.proj.toLonLat(osmGeometry.getCoordinates()));
                            if (dist < toleranceMeters) {
                                featuresToRemove.push(osmFeature);
                            }
                        }
                    });
                    
                    // Remove conflicting OSM features
                    featuresToRemove.forEach(feature => {
                        OSMManager.osmSource.removeFeature(feature);
                        const idx = OSMManager.osmFeatures.findIndex(f => f.feature === feature);
                        if (idx >= 0) OSMManager.osmFeatures.splice(idx, 1);
                    });
                    
                    const feature = new ol.Feature({
                        geometry: new ol.geom.Point(houseCoords),
                    });
                    
                    // Create OSM-like data structure for known houses
                    const osmData = {
                        id: houseId,
                        type: 'node',
                        lat: house.location[1],
                        lon: house.location[0],
                        tags: {
                            name: house.name,
                            building: 'house',
                            'historic': 'yes',
                            beds: house.beds,
                        }
                    };
                    
                    feature.setId(osmData.id);
                    feature.set('osmData', osmData);
                    OSMManager.osmSource.addFeature(feature);
                    OSMManager.osmFeatures.push({
                        id: osmData.id,
                        type: 'node',
                        tags: osmData.tags,
                        geometry: osmData,
                        feature: feature,
                        isKnownHouse: true,
                    });
                    
                    housesAdded++;
                }
            } catch (e) {
                console.error('Error loading known house:', house.name, e);
            }
        });

        if (housesAdded > 0) {
            OSMManager.lastLoadedBboxKey = null;
        }
    },
    
    createFeatureFromElement: (element) => {
        try {
            // Filter out trivial OSM details that shouldn't be buildings
            const blacklistedTagValuesByKey = {
                amenity: [
                    'bench',
                    'waste_basket',
                    'trash',
                    'bin',
                    'advertising',
                    'information',
                    'sign',
                    'bollard',
                    'hydrant',
                    'lamp',
                    'street_light',
                    'telephone',
                    'mailbox',
                    'post_box',
                    'drinking_water',
                    'fountain',
                    'bicycle_parking',
                    'bicycle_repair_station',
                    'vending_machine',
                    'parking_entrance',
                    'waste_disposal',
                    'waste_transfer_station',
                    'recycling',
                    'dog_toilet',
                    'clock',
                    'public_bookcase',
                    'water_point',
                    'payment_terminal',
                ],
                highway: [
                    'street_lamp',
                    'traffic_signals',
                    'crossing',
                    'bus_stop',
                    'turning_circle',
                ],
                leisure: [
                    'picnic_table',
                    'fitness_station',
                    'playground',
                ],
                man_made: [
                    'street_cabinet',
                    'surveillance',
                    'flagpole',
                ],
                parking: [
                    'bicycle',
                ],
                street_furniture: [
                    'bench',
                    'waste_basket',
                    'bollard',
                    'lamp',
                    'street_light',
                    'information',
                    'hydrant',
                    'drinking_fountain',
                ],
            };
            const tags = element.tags || {};
            
            // Check if this is a trivial feature
            for (const [tagKey, blockedValues] of Object.entries(blacklistedTagValuesByKey)) {
                if (!tags[tagKey]) continue;
                const value = String(tags[tagKey]).toLowerCase();
                if (blockedValues.includes(value)) {
                    return null;
                }
            }
            
            if (element.type === 'node' && element.lat && element.lon) {
                // Point feature
                const coords = ol.proj.fromLonLat([element.lon, element.lat]);
                const feature = new ol.Feature({
                    geometry: new ol.geom.Point(coords),
                });
                feature.setId(element.id);
                feature.set('osmData', element);
                return feature;
            } else if (element.type === 'way' && element.geometry) {
                // Polygon or LineString
                const coords = element.geometry.map(node => 
                    ol.proj.fromLonLat([node.lon, node.lat])
                );
                
                // Check if it's a closed way (polygon)
                const isClosed = coords.length > 2 && 
                    coords[0][0] === coords[coords.length - 1][0] &&
                    coords[0][1] === coords[coords.length - 1][1];
                
                const geometry = isClosed 
                    ? new ol.geom.Polygon([coords])
                    : new ol.geom.LineString(coords);
                
                const feature = new ol.Feature({ geometry });
                feature.setId(element.id);
                feature.set('osmData', element);
                return feature;
            }
        } catch (error) {
            console.error('Error creating feature:', error);
        }
        return null;
    },
    
    getOSMFeatureStyle: (feature) => {
        const osmData = feature.get('osmData');
        if (!osmData || !osmData.tags) {
            return OSMManager.getCachedStyle('unknown', false);
        }

        OSMManager.refreshOwnershipCache();

        const tags = osmData.tags;
        const isKnownHouse = osmData.id && String(osmData.id).startsWith('known_');

        // Check geometry type
        const geometry = feature.getGeometry();
        const geometryType = geometry ? geometry.getType() : 'unknown';
        const isPoint = geometryType === 'Point';
        const featureId = String(osmData.id);
        const civilizationColor = OSMManager.ownershipCache.ownerColorById[featureId] || OSMManager.ownershipCache.fallbackColor;
        const isClaimed = OSMManager.ownershipCache.claimedSet.has(featureId);
        
        // Known houses get special styling - gold/yellow when unclaimed
        if (isKnownHouse) {
            if (isClaimed) {
                return OSMManager.getCachedStyle('known-claimed', isPoint, civilizationColor);
            }
            return OSMManager.getCachedStyle('known-unclaimed', isPoint);
        }

        const buildingTypes = OSMManager.getCompatibleBuildingTypes(tags);

        if (isClaimed) {
            return OSMManager.getCachedStyle('claimed', isPoint, civilizationColor);
        }
        
        // Claimable but unclaimed
        if (buildingTypes.length > 0) {
            return OSMManager.getCachedStyle('claimable', isPoint);
        }

        // Not claimable - gray
        return OSMManager.getCachedStyle('non-claimable', isPoint);
    },
    
    getCompatibleBuildingTypes: (tags) => {
        const starterTypes = Array.isArray(CONFIG.MAIN_BUILDING_STARTERS)
            ? CONFIG.MAIN_BUILDING_STARTERS.filter((type) => !!CONFIG.BUILDINGS[type])
            : [];
        const normalizedBuildingTag = tags.building ? String(tags.building).toLowerCase() : '';
        const tagRestrictions = CONFIG.OSM_TAG_RESTRICTIONS || {};

        const checkTagRestriction = (tagValue) => {
            const normalizedValue = String(tagValue).toLowerCase();
            if (tagRestrictions[normalizedValue]) {
                return tagRestrictions[normalizedValue];
            }
            return null;
        };

        if (normalizedBuildingTag === 'yes') {
            const nonStrictTypes = Object.keys(CONFIG.BUILDINGS).filter((key) => !CONFIG.BUILDINGS[key].strictOsmMatch);
            return [...new Set([...starterTypes, ...nonStrictTypes])];
        }

        const signature = Object.keys(tags)
            .sort()
            .map((key) => `${key}=${String(tags[key]).toLowerCase()}`)
            .join('|');

        if (OSMManager.compatibleTypesCache[signature]) {
            return OSMManager.compatibleTypesCache[signature];
        }

        let restrictedToTypes = null;
        for (const [tagKey, tagValue] of Object.entries(tags)) {
            const restriction = checkTagRestriction(tagValue);
            if (restriction && Array.isArray(restriction) && restriction.length > 0) {
                restrictedToTypes = restriction;
                break;
            }
        }

        const compatible = [];
        
        Object.entries(CONFIG.BUILDINGS).forEach(([key, buildingDef]) => {
            if (restrictedToTypes && !restrictedToTypes.includes(key)) {
                return;
            }

            if (!buildingDef.osmTypes || buildingDef.osmTypes.length === 0) return;
            
            // Check if any tag matches the building's OSM types
            for (const [tagKey, tagValue] of Object.entries(tags)) {
                const tagStr = `${tagKey}=${tagValue}`.toLowerCase();
                const valueStr = String(tagValue).toLowerCase();
                const strictMatch = !!buildingDef.strictOsmMatch;
                
                if (buildingDef.osmTypes.some(osmType => 
                    strictMatch
                        ? (valueStr === osmType.toLowerCase())
                        : (valueStr.includes(osmType.toLowerCase()) || tagStr.includes(osmType.toLowerCase()))
                )) {
                    if (!restrictedToTypes || restrictedToTypes.includes(key)) {
                        compatible.push(key);
                    }
                    break;
                }
            }
        });

        const hasClaimableContext = !!(tags.building || tags.amenity || tags.shop || tags.landuse);
        if (hasClaimableContext && starterTypes.length > 0) {
            if (!restrictedToTypes || restrictedToTypes.some(t => starterTypes.includes(t))) {
                compatible.push(...starterTypes.filter(t => !restrictedToTypes || restrictedToTypes.includes(t)));
            }
        }

        const dedupedCompatible = [...new Set(compatible)];
        
        // Default: if it's a building and no restriction, allow HOUSE HQ or FARM
        if (dedupedCompatible.length === 0 && tags.building && !restrictedToTypes) {
            dedupedCompatible.push('HOUSE');
            dedupedCompatible.push('HQ');
        }
        
        OSMManager.compatibleTypesCache[signature] = dedupedCompatible;
        return dedupedCompatible;
    },

    refreshOwnershipCache: () => {
        const now = Date.now();
        if (now - OSMManager.lastOwnershipRefresh < OSMManager.ownershipRefreshIntervalMs) {
            return;
        }
        OSMManager.lastOwnershipRefresh = now;

        const buildings = Storage.getBuildings();
        const player = Storage.getPlayer();
        const aiPlayers = Storage.getAIPlayers();

        const fallbackColor = (player && player.civilizationColor) ? player.civilizationColor : '#22c55e';
        const aiColorByName = {};
        aiPlayers.forEach((ai) => {
            aiColorByName[ai.name] = ai.civilizationColor;
        });

        const claimedSet = new Set();
        const ownerColorById = {};

        buildings.forEach((building) => {
            const osmId = building.osmId;
            if (osmId === undefined || osmId === null) return;

            const id = String(osmId);
            claimedSet.add(id);

            if (!building.ownerId || building.ownerId === 'player') {
                ownerColorById[id] = fallbackColor;
            } else {
                ownerColorById[id] = aiColorByName[building.ownerId] || fallbackColor;
            }
        });

        OSMManager.ownershipCache = {
            claimedSet,
            ownerColorById,
            fallbackColor,
        };
    },

    getCachedStyle: (type, isPoint, color = null) => {
        const key = `${type}|${isPoint ? 'point' : 'shape'}|${color || ''}`;
        if (OSMManager.styleCache[key]) {
            return OSMManager.styleCache[key];
        }

        let fillColor = 'rgba(100, 100, 100, 0.2)';
        let strokeColor = '#666';
        let strokeWidth = 1;
        let pointRadius = 6;
        let pointFill = '#666';
        let pointStroke = '#fff';
        let pointStrokeWidth = 1;

        if (type === 'known-claimed' || type === 'claimed') {
            fillColor = `${color}CC`;
            strokeColor = color;
            strokeWidth = 3;
            pointRadius = type === 'known-claimed' ? 10 : 8;
            pointFill = color;
            pointStrokeWidth = 2;
        } else if (type === 'known-unclaimed') {
            fillColor = 'rgba(251, 191, 36, 0.3)';
            strokeColor = '#fbbf24';
            strokeWidth = 2;
            pointRadius = 8;
            pointFill = '#fbbf24';
            pointStrokeWidth = 2;
        } else if (type === 'claimable') {
            fillColor = 'rgba(74, 222, 128, 0.3)';
            strokeColor = '#4ade80';
            strokeWidth = 2;
            pointRadius = 6;
            pointFill = '#4ade80';
        } else if (type === 'non-claimable') {
            fillColor = 'rgba(100, 100, 100, 0.1)';
            strokeColor = '#666';
            strokeWidth = 1;
            pointRadius = 5;
            pointFill = '#666';
        }

        const style = new ol.style.Style({
            fill: new ol.style.Fill({ color: fillColor }),
            stroke: new ol.style.Stroke({ color: strokeColor, width: strokeWidth }),
        });

        if (isPoint) {
            style.setImage(new ol.style.Circle({
                radius: pointRadius,
                fill: new ol.style.Fill({ color: pointFill }),
                stroke: new ol.style.Stroke({ color: pointStroke, width: pointStrokeWidth }),
            }));
        }

        OSMManager.styleCache[key] = style;
        return style;
    },

    invalidateStyleCaches: () => {
        OSMManager.compatibleTypesCache = {};
        OSMManager.styleCache = {};
        OSMManager.lastOwnershipRefresh = 0;
    },
    
    getFeatureName: (tags) => {
        return tags.name || 
               tags['addr:street'] || 
               tags.building || 
               tags.amenity || 
               tags.shop || 
               tags.landuse || 
               'Unknown Location';
    },
};

window.OSMManager = OSMManager;

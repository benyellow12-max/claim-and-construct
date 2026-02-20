// Map initialization using OpenLayers
const MapManager = {
    map: null,
    vectorSource: null,
    vectorLayer: null,
    buildingSource: null,
    buildingLayer: null,
    lastOSMClickBucket: null,
    lastOSMCandidateSignature: null,
    lastOSMCandidateIndex: -1,
    
    init: () => {
        console.log('MapManager.init() called');
        // Vector source for bases
        MapManager.vectorSource = new ol.source.Vector();
        MapManager.vectorLayer = new ol.layer.Vector({
            source: MapManager.vectorSource,
            style: MapManager.getFeatureStyle,
            zIndex: 10,
        });
        
        // Vector source for buildings
        MapManager.buildingSource = new ol.source.Vector();
        MapManager.buildingLayer = new ol.layer.Vector({
            source: MapManager.buildingSource,
            style: MapManager.getBuildingStyle,
            zIndex: 9,
        });
        
        // OSM tile layer
        const osmLayer = new ol.layer.Tile({
            source: new ol.source.OSM(),
        });
        
        // Create map
        MapManager.map = new ol.Map({
            target: 'map',
            layers: [osmLayer, MapManager.buildingLayer, MapManager.vectorLayer],
            view: new ol.View({
                center: ol.proj.fromLonLat(CONFIG.mapCenter),
                zoom: CONFIG.mapZoom,
                maxZoom: CONFIG.maxZoom,
                minZoom: CONFIG.minZoom,
            }),
        });
        console.log('MapManager.map created:', !!MapManager.map, 'View:', !!MapManager.map.getView());
        
        // Click handler
        MapManager.map.on('click', MapManager.handleMapClick);
        
        // Draw existing bases and buildings
        MapManager.loadBases();
        MapManager.loadBuildings();
        
        // Initialize OSM features (after a short delay to let map settle)
        setTimeout(() => {
            OSMManager.init();
        }, 500);
    },
    
    loadBases: () => {
        MapManager.vectorSource.clear();
        const bases = Storage.getBases();
        
        bases.forEach(base => {
            const feature = new ol.Feature({
                geometry: new ol.geom.Point(ol.proj.fromLonLat(base.location)),
                baseId: base.id,
                baseData: base,
            });
            MapManager.vectorSource.addFeature(feature);
        });
    },
    
    loadBuildings: () => {
        MapManager.buildingSource.clear();
        const buildings = Storage.getBuildings();
        
        buildings.forEach(building => {
            // Skip buildings that are from actual OSM (not virtual) - they're shown on OSM layer
            // But include virtual buildings (AI buildings or player-created buildings)
            if (building.osmId && !building.isVirtual) {
                return;
            }
            
            const feature = new ol.Feature({
                geometry: new ol.geom.Point(ol.proj.fromLonLat(building.location || [0, 0])),
                buildingId: building.id,
                buildingData: building,
            });
            MapManager.buildingSource.addFeature(feature);
        });
    },
    
    handleMapClick: (event) => {
        try {
            console.log('Click detected at pixel:', event.pixel);
            console.log('OSMManager:', OSMManager);
            console.log('OSMManager.osmLayer:', OSMManager ? OSMManager.osmLayer : 'no OSMManager');
            
            // Only allow clicking on OSM features (buildings)
            if (OSMManager && OSMManager.osmLayer) {
                console.log('OSM layer exists, checking for features...');

                const featuresAtPixel = MapManager.map.getFeaturesAtPixel(event.pixel, {
                    hitTolerance: 8,
                    layerFilter: (layer) => layer === OSMManager.osmLayer,
                }) || [];

                const osmCandidates = featuresAtPixel
                    .filter((feature) => !!feature.get('osmData'))
                    .sort((featureA, featureB) => {
                        const geometryA = featureA.getGeometry();
                        const geometryB = featureB.getGeometry();

                        const rankByType = (geometry) => {
                            const type = geometry ? geometry.getType() : '';
                            if (type === 'Point') return 0;
                            if (type === 'LineString') return 1;
                            if (type === 'Polygon') return 2;
                            return 3;
                        };

                        const rankA = rankByType(geometryA);
                        const rankB = rankByType(geometryB);
                        if (rankA !== rankB) return rankA - rankB;

                        const metric = (geometry) => {
                            if (!geometry) return Number.POSITIVE_INFINITY;
                            const type = geometry.getType();
                            if (type === 'Polygon') return Math.abs(geometry.getArea());
                            if (type === 'LineString') return geometry.getLength();
                            return 0;
                        };

                        const metricA = metric(geometryA);
                        const metricB = metric(geometryB);
                        if (metricA !== metricB) return metricA - metricB;

                        return String(featureA.getId()).localeCompare(String(featureB.getId()));
                    });

                if (osmCandidates.length > 0) {
                    const clickBucket = `${Math.round(event.pixel[0] / 6)}:${Math.round(event.pixel[1] / 6)}`;
                    const candidateSignature = osmCandidates.map((feature) => String(feature.getId())).join('|');

                    const isSameClickArea =
                        MapManager.lastOSMClickBucket === clickBucket &&
                        MapManager.lastOSMCandidateSignature === candidateSignature;

                    const nextIndex = isSameClickArea
                        ? (MapManager.lastOSMCandidateIndex + 1) % osmCandidates.length
                        : 0;

                    MapManager.lastOSMClickBucket = clickBucket;
                    MapManager.lastOSMCandidateSignature = candidateSignature;
                    MapManager.lastOSMCandidateIndex = nextIndex;

                    const selectedFeature = osmCandidates[nextIndex];
                    console.log('Calling selectOSMFeature', {
                        selectedIndex: nextIndex,
                        candidateCount: osmCandidates.length,
                        selectedId: selectedFeature && selectedFeature.getId(),
                    });
                    Game.selectOSMFeature(selectedFeature);
                    return;
                }

                MapManager.lastOSMClickBucket = null;
                MapManager.lastOSMCandidateSignature = null;
                MapManager.lastOSMCandidateIndex = -1;
            } else {
                console.log('OSMManager not ready or osmLayer not initialized');
            }
        } catch (error) {
            console.error('Error handling map click:', error);
        }
    },
    
    getFeatureStyle: (feature) => {
        const base = feature.get('baseData');
        const isSelected = Game.selectedBase && 
            Game.selectedBase.id === base.id;
        
        // Get player's civilization color
        const player = Storage.getPlayer();
        const civilizationColor = player && player.civilizationColor ? player.civilizationColor : '#22c55e';
        
        const style = new ol.style.Style({
            image: new ol.style.Circle({
                radius: isSelected ? 12 : 10,
                fill: new ol.style.Fill({
                    color: civilizationColor + (isSelected ? 'F2' : 'CC'), // opacity: 95% or 80%
                }),
                stroke: new ol.style.Stroke({
                    color: civilizationColor,
                    width: 3,
                }),
            }),
        });
        
        return style;
    },
    
    getBuildingColorByType: (type) => {
        const colors = {
            'HQ': '#3b82f6', // Blue for HQ
            'HOUSE': '#ffc107',
            'FARM': '#4caf50',
            'GATHERING_STATION': '#9c27b0',
            'STORAGE': '#e91e63',
            'ARMORY': '#f44336',
            'GUNSMITH': '#b91c1c',
            'FORTIFICATION': '#6b7280',
            'RELIGIOUS': '#f59e0b',
            'WORKSHOP': '#14b8a6',
            'CLINIC': '#22c55e',
            'WATERWORKS': '#0ea5e9',
        };
        return colors[type] || '#4a9fd8';
    },
    
    getBuildingStyle: (feature) => {
        const building = feature.get('buildingData');
        const isSelected = Game.selectedBuilding && 
            Game.selectedBuilding.id === building.id;
        
        // Get owner's civilization color
        let civilizationColor = '#22c55e'; // default
        if (!building.ownerId || building.ownerId === 'player') {
            const player = Storage.getPlayer();
            civilizationColor = player && player.civilizationColor ? player.civilizationColor : '#22c55e';
        } else {
            // AI player owns this building
            const aiPlayers = Storage.getAIPlayers();
            const aiOwner = aiPlayers.find(ai => ai.name === building.ownerId);
            civilizationColor = aiOwner ? aiOwner.civilizationColor : '#22c55e';
        }
        
        const opacity = isSelected ? 0.95 : 0.8;
        const opacityHex = Math.floor(opacity * 255).toString(16).padStart(2, '0');
        const color = civilizationColor + opacityHex;
        
        const style = new ol.style.Style({
            image: new ol.style.Circle({
                radius: isSelected ? 10 : 8,
                fill: new ol.style.Fill({ color: color }),
                stroke: new ol.style.Stroke({
                    color: isSelected ? '#fff' : civilizationColor,
                    width: isSelected ? 3 : 2,
                }),
            }),
        });
        
        return style;
    },
    
    addBaseMarker: (base) => {
        const feature = new ol.Feature({
            geometry: new ol.geom.Point(ol.proj.fromLonLat(base.location)),
            baseId: base.id,
            baseData: base,
        });
        MapManager.vectorSource.addFeature(feature);
    },
    
    addBuildingMarker: (building) => {
        // Skip buildings that are from actual OSM (not virtual) - they're shown on OSM layer
        // But include virtual buildings (AI buildings or player-created buildings)
        if (building.osmId && !building.isVirtual) {
            return;
        }
        
        const feature = new ol.Feature({
            geometry: new ol.geom.Point(ol.proj.fromLonLat(building.location || [0, 0])),
            buildingId: building.id,
            buildingData: building,
        });
        MapManager.buildingSource.addFeature(feature);
    },
    
    updateBaseMarker: (baseId) => {
        const base = Storage.getBases().find(b => b.id === baseId);
        if (base) {
            const feature = MapManager.vectorSource.getFeatures()
                .find(f => f.get('baseId') === baseId);
            if (feature) {
                feature.set('baseData', base);
                MapManager.vectorLayer.changed();
            }
        }
    },
    
    updateBuildingMarker: (buildingId) => {
        const building = Storage.getBuildings().find(b => b.id === buildingId);
        if (building) {
            const feature = MapManager.buildingSource.getFeatures()
                .find(f => f.get('buildingId') === buildingId);
            if (feature) {
                feature.set('buildingData', building);
                MapManager.buildingLayer.changed();
            }
        }
    },
    
    locatePlayer: () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const coords = [position.coords.longitude, position.coords.latitude];
                    MapManager.centerOn(coords);
                },
                () => {
                    console.error('Geolocation failed');
                }
            );
        }
    },
    
    centerOn: (lonLat) => {
        MapManager.map.getView().animate({
            center: ol.proj.fromLonLat(lonLat),
            zoom: 12,
            duration: 1000,
        });
    },
    
    zoomIn: () => {
        console.log('zoomIn called, MapManager.map exists:', !!MapManager.map);
        const view = MapManager.map.getView();
        const currentZoom = view.getZoom();
        const maxZoom = view.getMaxZoom();
        console.log('Current zoom:', currentZoom, 'Max zoom:', maxZoom);
        if (currentZoom < maxZoom) {
            console.log('Zooming in to:', currentZoom + 1);
            view.animate({
                zoom: currentZoom + 1,
                duration: 300,
            });
        }
    },
    
    zoomOut: () => {
        console.log('zoomOut called, MapManager.map exists:', !!MapManager.map);
        const view = MapManager.map.getView();
        const currentZoom = view.getZoom();
        const minZoom = view.getMinZoom();
        console.log('Current zoom:', currentZoom, 'Min zoom:', minZoom);
        if (currentZoom > minZoom) {
            console.log('Zooming out to:', currentZoom - 1);
            view.animate({
                zoom: currentZoom - 1,
                duration: 300,
            });
        }
    },
};

window.MapManager = MapManager;

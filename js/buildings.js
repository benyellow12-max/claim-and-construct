// Buildings management - claiming, upgrading, job slots
const Buildings = {
    getReligionBuildingName: (religion) => {
        return CONFIG.RELIGION_BUILDINGS[religion] || 'Religious Site';
    },

    getReligionJobName: (religion) => {
        return CONFIG.RELIGION_JOB_TITLES[religion] || 'Clergy';
    },

    getBuildingTier: (type) => {
        const progression = CONFIG.BUILDING_PROGRESSION || {};
        return progression.tiers?.[type] || 1;
    },

    getHighestTier: () => {
        const progression = CONFIG.BUILDING_PROGRESSION || {};
        const tiers = progression.tiers || {};
        const values = Object.values(tiers);
        return values.length > 0 ? Math.max(...values) : 1;
    },

    isTopTierType: (type) => {
        return Buildings.getBuildingTier(type) >= Buildings.getHighestTier();
    },

    getSourceTagsForBuilding: (building) => {
        if (building.sourceTags) {
            return building.sourceTags;
        }

        if (!building.osmId || !OSMManager || !Array.isArray(OSMManager.osmFeatures)) {
            return null;
        }

        const found = OSMManager.osmFeatures.find(f => String(f.id) === String(building.osmId));
        return found?.tags || null;
    },

    getUpgradeOptions: (building) => {
        if (!building) return [];

        const progression = CONFIG.BUILDING_PROGRESSION || {};
        const upgrades = progression.upgrades || {};
        const nextTypes = upgrades[building.type] || [];
        if (nextTypes.length === 0) {
            return [];
        }

        const sourceTags = Buildings.getSourceTagsForBuilding(building);
        const compatibleTypes = (sourceTags && OSMManager && typeof OSMManager.getCompatibleBuildingTypes === 'function')
            ? OSMManager.getCompatibleBuildingTypes(sourceTags)
            : null;
        const playerBuildings = Storage.getBuildings().filter(b => (!b.ownerId || b.ownerId === 'player') && b.id !== building.id);

        return nextTypes
            .filter((targetType) => {
                const targetDef = CONFIG.BUILDINGS[targetType];
                if (!targetDef) return false;

                const currentTier = Buildings.getBuildingTier(building.type);
                const targetTier = Buildings.getBuildingTier(targetType);
                if (targetTier <= currentTier) return false;

                if (targetDef.strictOsmMatch) {
                    if (!compatibleTypes || !compatibleTypes.includes(targetType)) {
                        return false;
                    }
                }

                if (Buildings.isTopTierType(targetType) && playerBuildings.some(b => b.type === targetType)) {
                    return false;
                }

                return true;
            })
            .map((targetType) => {
                const tier = Buildings.getBuildingTier(targetType);
                return {
                    type: targetType,
                    tier,
                    scrapCost: tier,
                    toolCost: tier,
                    name: CONFIG.BUILDINGS[targetType].name,
                };
            });
    },

    claimOSMBuilding: (osmId, type, name, location, extraProperties = {}) => {
        // New method for claiming OSM features
        const buildingDef = CONFIG.BUILDINGS[type];
        const osmFeature = OSMManager?.osmFeatures?.find(f => String(f.id) === String(osmId));
        
        // Generate building properties based on type
        const properties = {
            location: location,
            sourceTags: extraProperties.sourceTags || osmFeature?.tags || null,
            ...extraProperties,
        };
        
        // Check if this is a known house
        let knownHouse = null;
        if (osmId.startsWith('known_')) {
            knownHouse = CONFIG.KNOWN_HOUSES.find(h => 'known_' + h.name.replace(/\s+/g, '_') === osmId);
        }
        
        // For HQ claimed from houses, use house bed generation but keep HQ properties
        if (type === 'HQ') {
            if (knownHouse) {
                properties.beds = knownHouse.beds;
            } else {
                const houseDef = CONFIG.BUILDINGS.HOUSE;
                properties.beds = Math.floor(
                    Math.random() * (houseDef.bedsMax - houseDef.bedsMin + 1) + houseDef.bedsMin
                );
            }
            properties.storage = CONFIG.BUILDINGS.HOUSE.storageCapacity || 0;
        } else if (buildingDef.bedsMin) {
            // For regular houses or other buildings
            if (knownHouse) {
                properties.beds = knownHouse.beds;
            } else {
                properties.beds = Math.floor(
                    Math.random() * (buildingDef.bedsMax - buildingDef.bedsMin + 1) + buildingDef.bedsMin
                );
            }
        }
        
        if (buildingDef.storageCapacity && !properties.storage) {
            properties.storage = buildingDef.storageCapacity;
        }
        
        const result = Buildings.claimBuilding(osmId, type, name, properties);
        
        if (result) {
            // Refresh OSM layer to show claimed building
            MapManager.loadBuildings();
            if (OSMManager.osmSource) {
                OSMManager.osmSource.changed();
            }
            Resources.updateUI();
        }
        
        return result;
    },
    
    claimBuilding: (osmId, type, name, properties = {}) => {
        const existing = Storage.getBuildings().find(b => b.osmId === osmId);
        if (existing) {
            Game.addLog('This building is already claimed!', 'error');
            return false;
        }
        
        const buildingDef = CONFIG.BUILDINGS[type];
        if (!buildingDef) {
            Game.addLog('Invalid building type!', 'error');
            return false;
        }

        const defaultDefense = type === 'HQ' ? 500 : (type === 'HOUSE' ? 100 : 150);
        const defenseValue = properties.defense ?? buildingDef.defense ?? defaultDefense;
        
        // Check if HQ is unique and already exists
        if (buildingDef.unique) {
            const allBuildings = Storage.getBuildings();
            const playerBuildings = allBuildings.filter(b => !b.ownerId || b.ownerId === 'player');
            const hqExists = playerBuildings.some(b => b.type === type);
            if (hqExists) {
                Game.addLog('You can only have one Headquarters!', 'error');
                return false;
            }
        }
        
        const player = Storage.getPlayer();
        
        // Check resource costs
        const scrapCost = buildingDef.scrapCost || 0;
        const toolCost = buildingDef.toolCost || 0;
        
        if (player.scrap < scrapCost) {
            Game.addLog('Not enough scrap!', 'error');
            return false;
        }
        if ((player.tools || 0) < toolCost) {
            Game.addLog('Not enough tools!', 'error');
            return false;
        }
        
        // Deduct costs
        if (scrapCost > 0) {
            player.scrap -= scrapCost;
        }
        if (toolCost > 0) {
            player.tools = Math.max(0, (player.tools || 0) - toolCost);
        }
        if (scrapCost > 0 || toolCost > 0) {
            Storage.setPlayer(player);
        }
        
        // Claim building
        const building = Storage.addBuilding({
            osmId: osmId,
            type: type,
            level: Buildings.getBuildingTier(type),
            name: name,
            location: properties.location || [0, 0],
            defense: defenseValue,
            religion: properties.religion || null,
            beds: properties.beds || (buildingDef.bedsMin || 0),
            storage: properties.storage || buildingDef.storageCapacity || 0,
            jobSlots: buildingDef.jobSlots || 0,
            sourceTags: properties.sourceTags || null,
            claimedAt: Date.now(),
            ownerId: 'player', // Default to player
        });
        
        Game.addLog(`${buildingDef.name} claimed!`, 'success');
        
        // Award XP
        Resources.addXP(type === 'HQ' ? 100 : 25);
        
        // Force OSM layer to redraw with new styles
        if (OSMManager && OSMManager.osmLayer) {
            if (typeof OSMManager.invalidateStyleCaches === 'function') {
                OSMManager.invalidateStyleCaches();
            }
            console.log('Forcing OSM layer refresh after claiming building');
            OSMManager.osmSource.changed();
            OSMManager.osmLayer.changed();
            // Force all features to re-evaluate their styles
            const features = OSMManager.osmSource.getFeatures();
            features.forEach(f => {
                const osmData = f.get('osmData');
                if (osmData && osmData.id === osmId) {
                    console.log('Found claimed feature, forcing style update for:', osmId);
                    f.changed();
                }
            });
        }
        
        return building;
    },
    
    upgradeBuilding: (buildingId, targetType = null) => {
        const building = Storage.getBuildings().find(b => b.id === buildingId);
        if (!building) return false;

        const options = Buildings.getUpgradeOptions(building);
        if (options.length === 0) {
            Game.addLog('No valid upgrades available at this location.', 'warning');
            return false;
        }

        const selected = targetType
            ? options.find(o => o.type === targetType)
            : options[0];

        if (!selected) {
            Game.addLog('That upgrade is not available for this building.', 'error');
            return false;
        }

        const player = Storage.getPlayer();
        if ((player.scrap || 0) < selected.scrapCost) {
            Game.addLog(`Not enough scrap! Need ${selected.scrapCost}.`, 'error');
            return false;
        }
        if ((player.tools || 0) < selected.toolCost) {
            Game.addLog(`Not enough tools! Need ${selected.toolCost}.`, 'error');
            return false;
        }

        player.scrap = Math.max(0, (player.scrap || 0) - selected.scrapCost);
        player.tools = Math.max(0, (player.tools || 0) - selected.toolCost);
        Storage.setPlayer(player);

        const targetDef = CONFIG.BUILDINGS[selected.type];
        const updatedBuilding = {
            ...building,
            type: selected.type,
            level: selected.tier,
            defense: targetDef.defense ?? building.defense,
            storage: targetDef.storageCapacity || 0,
            jobSlots: targetDef.jobSlots || 0,
            religion: selected.type === 'RELIGIOUS'
                ? (building.religion || Resources.getPreferredReligion(player, Storage.getCitizens()))
                : null,
        };

        if (targetDef.bedsMin !== undefined && targetDef.bedsMax !== undefined) {
            const currentBeds = building.beds || targetDef.bedsMin;
            updatedBuilding.beds = Math.min(targetDef.bedsMax, Math.max(targetDef.bedsMin, currentBeds));
        } else {
            updatedBuilding.beds = 0;
        }

        Storage.updateBuilding(buildingId, updatedBuilding);
        Game.addLog(`Upgraded to ${targetDef.name} (Tier ${selected.tier})!`, 'success');
        Resources.addXP(50);

        if (MapManager && MapManager.buildingLayer) {
            MapManager.loadBuildings();
        }
        if (OSMManager && OSMManager.osmLayer) {
            OSMManager.osmLayer.changed();
        }
        Resources.updateUI();
        
        return true;
    },
    
    assignJob: (jobType) => {
        try {
            console.log('assignJob called with:', jobType);
            // Find first idle citizen and assign job
            const citizens = Storage.getCitizens();
            const idleCitizenIndex = citizens.findIndex(c => !c.job && c.ageGroup === 'adult');
            
            console.log('Idle adult found at index:', idleCitizenIndex);
            
            if (idleCitizenIndex === -1) {
                Game.addLog('No idle citizens available!', 'warning');
                return false;
            }
            
            const idleCitizen = citizens[idleCitizenIndex];
            
            const jobDef = CONFIG.JOBS[jobType.toUpperCase()];
            if (!jobDef) {
                Game.addLog('Invalid job type!', 'error');
                return false;
            }

            let assignedBuildingId = null;
            
            // Check if building exists (if required)
            if (jobDef.building) {
                const building = Buildings.findAvailableBuildingForJob(jobType.toLowerCase());
                if (!building) {
                    const capacity = Buildings.getJobCapacity(jobType.toLowerCase());
                    if (capacity.totalSlots > 0 && capacity.availableSlots === 0) {
                        Game.addLog(`All ${jobDef.name} job slots are full!`, 'warning');
                    } else {
                        Game.addLog(`${jobDef.name} requires a ${jobDef.building} building!`, 'error');
                    }
                    return false;
                }

                assignedBuildingId = building.id;
            }

            Storage.updateCitizen(idleCitizen.id, {
                job: jobType.toLowerCase(),
                buildingId: assignedBuildingId,
            });

            let displayName = jobDef.name;
            if (jobType.toUpperCase() === 'PRIEST' && assignedBuildingId) {
                const assignedBuilding = Storage.getBuildings().find(b => b.id === assignedBuildingId);
                if (assignedBuilding && assignedBuilding.religion) {
                    displayName = Buildings.getReligionJobName(assignedBuilding.religion);
                }
            }

            Game.addLog(`Citizen assigned to ${displayName}`, 'success');
            
            // Refresh the government modal if it's open
            const govModal = document.getElementById('government-modal');
            if (govModal && govModal.style.display !== 'none') {
                Game.showGovernmentModal();
            }
            
            return true;
        } catch (err) {
            console.error('Error in assignJob:', err);
            Game.addLog('Error assigning job!', 'error');
            return false;
        }
    },

    getJobCapacity: (jobType) => {
        const normalizedJob = jobType.toLowerCase();
        const jobDef = CONFIG.JOBS[normalizedJob.toUpperCase()];
        const citizens = Storage.getCitizens();
        const assigned = citizens.filter(c => c.job === normalizedJob).length;

        if (!jobDef) {
            return { assigned, totalSlots: 0, availableSlots: 0, unlimited: false };
        }

        if (!jobDef.building) {
            return { assigned, totalSlots: null, availableSlots: null, unlimited: true };
        }

        const playerBuildings = Storage.getBuildings().filter(b => !b.ownerId || b.ownerId === 'player');
        const matchingBuildings = playerBuildings.filter(b => b.type.toLowerCase() === jobDef.building);

        const totalSlots = matchingBuildings.reduce((sum, building) => {
            const buildingDef = CONFIG.BUILDINGS[building.type];
            return sum + (building.jobSlots || (buildingDef ? buildingDef.jobSlots : 0) || 0);
        }, 0);

        const availableSlots = Math.max(0, totalSlots - assigned);
        return { assigned, totalSlots, availableSlots, unlimited: false };
    },

    findAvailableBuildingForJob: (jobType) => {
        const normalizedJob = jobType.toLowerCase();
        const jobDef = CONFIG.JOBS[normalizedJob.toUpperCase()];
        if (!jobDef || !jobDef.building) return null;

        const playerBuildings = Storage.getBuildings().filter(b => !b.ownerId || b.ownerId === 'player');
        const matchingBuildings = playerBuildings.filter(b => b.type.toLowerCase() === jobDef.building);

        for (const building of matchingBuildings) {
            const buildingDef = CONFIG.BUILDINGS[building.type];
            const capacity = building.jobSlots || (buildingDef ? buildingDef.jobSlots : 0) || 0;
            const used = Storage.getCitizens().filter(c => c.job === normalizedJob && c.buildingId === building.id).length;
            if (used < capacity) {
                return building;
            }
        }

        return null;
    },
    
    unassignJob: (jobType) => {
        try {
            console.log('unassignJob called with:', jobType);
            // Find first citizen with this job and make them idle
            const citizens = Storage.getCitizens();
            const workerIndex = citizens.findIndex(c => c.job === jobType.toLowerCase());
            
            console.log('Worker found at index:', workerIndex);
            
            if (workerIndex === -1) {
                Game.addLog('No citizens have this job!', 'warning');
                return false;
            }

            const worker = citizens[workerIndex];
            Storage.updateCitizen(worker.id, { job: null, buildingId: null });
            Game.addLog('Citizen is now idle', 'info');
            
            // Refresh the government modal if it's open
            const govModal = document.getElementById('government-modal');
            if (govModal && govModal.style.display !== 'none') {
                Game.showGovernmentModal();
            }
            
            return true;
        } catch (err) {
            console.error('Error in unassignJob:', err);
            Game.addLog('Error unassigning job!', 'error');
            return false;
        }
    },

    assignCitizenToJob: (citizenId, jobType, buildingId) => {
        try {
            const citizens = Storage.getCitizens();
            const citizen = citizens.find(c => c.id === citizenId);
            if (!citizen) {
                Game.addLog('Citizen not found!', 'error');
                return false;
            }

            const building = Storage.getBuildings().find(b => b.id === buildingId);
            if (!building || (building.ownerId && building.ownerId !== 'player')) {
                Game.addLog('Building not found or not owned by you!', 'error');
                return false;
            }

            const jobDef = CONFIG.JOBS[jobType.toUpperCase()];
            if (!jobDef) {
                Game.addLog('Invalid job type!', 'error');
                return false;
            }

            if (jobDef.building && jobDef.building !== building.type.toLowerCase()) {
                Game.addLog('This job is not compatible with that building!', 'error');
                return false;
            }

            const slotCounts = Buildings.getJobSlotsCounts(buildingId);
            if (slotCounts.available <= 0) {
                Game.addLog('No job slots available in this building!', 'warning');
                return false;
            }

            Storage.updateCitizen(citizenId, {
                job: jobType.toLowerCase(),
                buildingId: buildingId,
            });

            let displayName = jobDef.name;
            if (jobType.toUpperCase() === 'PRIEST' && building.religion) {
                displayName = Buildings.getReligionJobName(building.religion);
            }

            Game.addLog(`${citizen.name} assigned to ${displayName}`, 'success');
            Resources.updateUI();
            return true;
        } catch (err) {
            console.error('Error in assignCitizenToJob:', err);
            Game.addLog('Error assigning citizen to job!', 'error');
            return false;
        }
    },
    
    getTotalBeds: () => {
        const buildings = Storage.getBuildings();
        // Only count buildings owned by the player
        const playerBuildings = buildings.filter(b => !b.ownerId || b.ownerId === 'player');
        return playerBuildings.reduce((sum, b) => sum + (b.beds || 0), 0);
    },
    
    getTotalStorage: () => {
        const buildings = Storage.getBuildings();
        // Only count buildings owned by the player
        const playerBuildings = buildings.filter(b => !b.ownerId || b.ownerId === 'player');
        return playerBuildings.reduce((sum, b) => sum + (b.storage || 0), 0);
    },
    
    getJobSlotsCounts: (buildingId) => {
        const citizens = Storage.getCitizens();
        const allBuildings = Storage.getBuildings();
        const building = allBuildings.find(b => b.id === buildingId);
        
        if (!building) return { used: 0, available: 0 };
        
        // Find job associated with this building type
        const jobEntry = Object.entries(CONFIG.JOBS).find(
            ([key, jobDef]) => jobDef.building === building.type.toLowerCase()
        );
        
        if (!jobEntry) return { used: 0, available: 0 };
        
        const jobKey = jobEntry[0].toLowerCase();
        const used = citizens.filter(c => c.job === jobKey && c.buildingId === buildingId).length;
        const buildingDef = CONFIG.BUILDINGS[building.type];
        
        return {
            used: used,
            available: (building.jobSlots || buildingDef.jobSlots) - used,
        };
    },
    
    getBuildingInfo: (building) => {
        const buildingDef = CONFIG.BUILDINGS[building.type];
        const jobCounts = Buildings.getJobSlotsCounts(building.id);
        const displayName = building.type === 'RELIGIOUS' && building.religion
            ? Buildings.getReligionBuildingName(building.religion)
            : buildingDef.name;
        
        let info = `
            <strong>${building.name}</strong><br>
            Type: ${displayName}<br>
            Level: ${building.level}<br>
        `;

        if (building.defense !== undefined) {
            info += `Defense: ${building.defense}<br>`;
        }
        
        if (building.beds) {
            info += `Beds: ${building.beds}<br>`;
        }
        
        if (building.storage) {
            info += `Storage: ${building.storage}<br>`;
        }
        
        if (building.jobSlots) {
            info += `Job Slots: ${jobCounts.used}/${jobCounts.available}<br>`;
        }
        
        info += `Claimed: ${new Date(building.claimedAt).toLocaleDateString()}<br>`;
        
        return info;
    },
};

window.Buildings = Buildings;

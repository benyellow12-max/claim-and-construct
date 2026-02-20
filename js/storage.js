// LocalStorage management with fallback for file:// protocol
const Storage = {
    useMemory: false,
    memoryData: {},
    
    init: () => {
        // Test if localStorage is available
        try {
            const test = '__localStorage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
        } catch(e) {
            console.warn('localStorage not available, using in-memory storage');
            Storage.useMemory = true;
        }
    },
    
    key: (name) => `${CONFIG.storagePrefix}${name}`,
    
    getMemoryData: (key) => {
        return Storage.memoryData[key];
    },
    
    setMemoryData: (key, value) => {
        Storage.memoryData[key] = value;
    },
    
    // Game state
    getGameState: () => {
        const key = Storage.key('gameState');
        const data = Storage.useMemory 
            ? Storage.getMemoryData(key)
            : localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    },
    
    setGameState: (state) => {
        const key = Storage.key('gameState');
        const data = JSON.stringify(state);
        if (Storage.useMemory) {
            Storage.setMemoryData(key, data);
        } else {
            localStorage.setItem(key, data);
        }
    },
    
    // Player profile
    getPlayer: () => {
        const key = Storage.key('player');
        const data = Storage.useMemory 
            ? Storage.getMemoryData(key)
            : localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    },
    
    setPlayer: (player) => {
        const key = Storage.key('player');
        const data = JSON.stringify(player);
        if (Storage.useMemory) {
            Storage.setMemoryData(key, data);
        } else {
            localStorage.setItem(key, data);
        }
    },
    
    // AI Players
    getAIPlayers: () => {
        const key = Storage.key('aiPlayers');
        const data = Storage.useMemory 
            ? Storage.getMemoryData(key)
            : localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    },
    
    setAIPlayers: (aiPlayers) => {
        const key = Storage.key('aiPlayers');
        const data = JSON.stringify(aiPlayers);
        if (Storage.useMemory) {
            Storage.setMemoryData(key, data);
        } else {
            localStorage.setItem(key, data);
        }
    },
    
    // Bases (array of base objects)
    getBases: () => {
        const key = Storage.key('bases');
        const data = Storage.useMemory 
            ? Storage.getMemoryData(key) 
            : localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    },
    
    setBases: (bases) => {
        const key = Storage.key('bases');
        const data = JSON.stringify(bases);
        if (Storage.useMemory) {
            Storage.setMemoryData(key, data);
        } else {
            localStorage.setItem(key, data);
        }
    },
    
    // Add single base
    addBase: (base) => {
        const bases = Storage.getBases();
        bases.push({
            ...base,
            id: Date.now() + Math.random(),
            createdAt: Date.now(),
        });
        Storage.setBases(bases);
        return bases[bases.length - 1];
    },
    
    // Update base
    updateBase: (baseId, updates) => {
        const bases = Storage.getBases();
        const index = bases.findIndex(b => b.id === baseId);
        if (index !== -1) {
            bases[index] = { ...bases[index], ...updates };
            Storage.setBases(bases);
            return bases[index];
        }
        return null;
    },
    
    // Citizens
    getCitizens: () => {
        const key = Storage.key('citizens');
        const data = Storage.useMemory 
            ? Storage.getMemoryData(key)
            : localStorage.getItem(key);
        const citizens = data ? JSON.parse(data) : [];

        // Backward compatibility: ensure every citizen has a stable id
        let changed = false;
        citizens.forEach((citizen, index) => {
            if (!citizen.id) {
                citizen.id = `citizen_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`;
                changed = true;
            }
            if (!citizen.religion) {
                const religions = CONFIG.DEMOGRAPHICS.religions;
                citizen.religion = religions[Math.floor(Math.random() * religions.length)];
                changed = true;
            }
        });

        if (changed) {
            Storage.setCitizens(citizens);
        }

        return citizens;
    },
    
    setCitizens: (citizens) => {
        const key = Storage.key('citizens');
        const data = JSON.stringify(citizens);
        if (Storage.useMemory) {
            Storage.setMemoryData(key, data);
        } else {
            localStorage.setItem(key, data);
        }
    },
    
    addCitizen: (excludeChildren = false) => {
        const citizens = Storage.getCitizens();
        
        // Generate demographics
        const demographics = Storage.generateDemographics(excludeChildren);
        
        const citizen = {
            id: `citizen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: `Citizen ${citizens.length + 1}`,
            job: null,
            gender: demographics.gender,
            ageGroup: demographics.ageGroup,
            religion: demographics.religion,
            ethnicity: demographics.ethnicity,
        };
        citizens.push(citizen);
        Storage.setCitizens(citizens);
        return citizen;
    },
    
    generateDemographics: (excludeChildren = false) => {
        // Select age group based on weights
        let ageGroups = CONFIG.DEMOGRAPHICS.ageGroups;
        
        // Filter out children if requested (for natural arrivals)
        if (excludeChildren) {
            ageGroups = Object.fromEntries(
                Object.entries(ageGroups).filter(([key]) => key !== 'child')
            );
        }
        
        const totalWeight = Object.values(ageGroups).reduce((sum, g) => sum + g.weight, 0);
        let random = Math.random() * totalWeight;
        let selectedGroup = 'adult';
        
        for (const [groupName, group] of Object.entries(ageGroups)) {
            random -= group.weight;
            if (random <= 0) {
                selectedGroup = groupName;
                break;
            }
        }
        
        const group = ageGroups[selectedGroup];
        const age = Math.floor(Math.random() * (group.max - group.min + 1)) + group.min;
        
        // Random gender
        const genders = CONFIG.DEMOGRAPHICS.genders;
        const gender = genders[Math.floor(Math.random() * genders.length)];
        
        // Random religion
        const religions = CONFIG.DEMOGRAPHICS.religions;
        const religion = religions[Math.floor(Math.random() * religions.length)];
        
        // Random ethnicity
        const ethnicities = CONFIG.DEMOGRAPHICS.ethnicities;
        const ethnicity = ethnicities[Math.floor(Math.random() * ethnicities.length)];
        
        return {
            ageGroup: selectedGroup,
            gender,
            religion,
            ethnicity,
        };
    },
    
    updateCitizen: (citizenId, updates) => {
        const citizens = Storage.getCitizens();
        const index = citizens.findIndex(c => c.id === citizenId);
        if (index !== -1) {
            citizens[index] = { ...citizens[index], ...updates };
            Storage.setCitizens(citizens);
            return citizens[index];
        }
        return null;
    },
    
    removeCitizen: (index) => {
        const citizens = Storage.getCitizens();
        if (index >= 0 && index < citizens.length) {
            citizens.splice(index, 1);
            Storage.setCitizens(citizens);
        }
    },
    
    // Buildings (claimed structures on map)
    getBuildings: () => {
        const key = Storage.key('buildings');
        const data = Storage.useMemory 
            ? Storage.getMemoryData(key)
            : localStorage.getItem(key);
        const buildings = data ? JSON.parse(data) : [];

        let changed = false;
        buildings.forEach((building) => {
            if (building.defense === undefined) {
                const buildingDef = CONFIG.BUILDINGS[building.type];
                const defaultDefense = building.type === 'HQ' ? 500 : (building.type === 'HOUSE' ? 100 : 150);
                building.defense = buildingDef?.defense ?? defaultDefense;
                changed = true;
            }
        });

        if (changed) {
            Storage.setBuildings(buildings);
        }

        return buildings;
    },
    
    setBuildings: (buildings) => {
        const key = Storage.key('buildings');
        const data = JSON.stringify(buildings);
        if (Storage.useMemory) {
            Storage.setMemoryData(key, data);
        } else {
            localStorage.setItem(key, data);
        }
    },
    
    addBuilding: (building) => {
        const buildings = Storage.getBuildings();
        const newBuilding = {
            ...building,
            id: Date.now() + Math.random(),
            claimedAt: Date.now(),
        };
        buildings.push(newBuilding);
        Storage.setBuildings(buildings);
        return newBuilding;
    },
    
    updateBuilding: (buildingId, updates) => {
        const buildings = Storage.getBuildings();
        const index = buildings.findIndex(b => b.id === buildingId);
        if (index !== -1) {
            buildings[index] = { ...buildings[index], ...updates };
            Storage.setBuildings(buildings);
            return buildings[index];
        }
        return null;
    },
    
    getBuildingsByType: (type) => {
        return Storage.getBuildings().filter(b => b.type === type);
    },
    
    // Clear all game data
    clearGame: () => {
        localStorage.removeItem(Storage.key('gameState'));
        localStorage.removeItem(Storage.key('player'));
        localStorage.removeItem(Storage.key('aiPlayers'));
        localStorage.removeItem(Storage.key('bases'));
        localStorage.removeItem(Storage.key('citizens'));
        localStorage.removeItem(Storage.key('buildings'));
    },
};

window.Storage = Storage;

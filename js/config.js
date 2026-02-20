// Configuration constants
const CONFIG = {
    // Map defaults
    mapCenter: [-98.5795, 39.8283], // Center of USA (lon, lat)
    mapZoom: 5,
    maxZoom: 18,
    minZoom: 3,
    
    // Game balance
    initialCitizens: 3,
    initialFood: 100,
    initialSeeds: 20,
    initialScrap: 50,
    initialHappiness: 70,
    
    // Building costs
    buildCost: 100, // legacy, not used
    buildTime: 5000, // milliseconds
    
    // Leveling
    xpPerBase: 50,
    xpPerLevel: 100,
    
    // OSM defaults
    osmTileUrl: 'http://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    
    // Storage keys
    storagePrefix: 'claimconstruct_',
    
    // Building types definition
    BUILDINGS: {
        HQ: {
            id: 'hq',
            name: 'Headquarters',
            description: 'Central base and town center',
            defense: 500,
            bedsMin: 10,
            bedsMax: 20,
            storageCapacity: 500,
            jobSlots: 2,
            osmTypes: ['house', 'residential'],
            buildCost: 0,
            buildTime: 0,
            unique: true, // Only one allowed
        },
        HOUSE: {
            id: 'house',
            name: 'House',
            description: 'Residential building',
            defense: 100,
            bedsMin: 6,
            bedsMax: 12,
            storageCapacity: 50,
            osmTypes: ['house', 'residential'], // Can be claimed from OSM
            buildCost: 150,
            buildTime: 3000,
        },
        COTTAGE_BLOCK: {
            id: 'cottage_block',
            name: 'Cottage Block',
            description: 'Cluster of detached and terrace homes',
            defense: 110,
            bedsMin: 8,
            bedsMax: 14,
            storageCapacity: 60,
            jobSlots: 1,
            osmTypes: ['detached', 'terrace'],
            strictOsmMatch: true,
            buildCost: 190,
            buildTime: 3800,
        },
        APARTMENT_BUILDING: {
            id: 'apartment_building',
            name: 'Apartment Building',
            description: 'High-capacity residential complex',
            defense: 130,
            bedsMin: 20,
            bedsMax: 30,
            storageCapacity: 120,
            osmTypes: ['apartments'],
            strictOsmMatch: true,
            buildCost: 320,
            buildTime: 6500,
        },
        HOSTEL: {
            id: 'hostel',
            name: 'Hostel Complex',
            description: 'Dormitory and hotel facilities repurposed for housing',
            defense: 120,
            bedsMin: 14,
            bedsMax: 24,
            storageCapacity: 80,
            jobSlots: 2,
            osmTypes: ['dormitory', 'hotel'],
            strictOsmMatch: true,
            buildCost: 280,
            buildTime: 5200,
        },
        FARM: {
            id: 'farm',
            name: 'Farm',
            description: 'Produces food from seeds',
            defense: 150,
            jobSlots: 5,
            osmTypes: ['farm', 'farmland'],
            strictOsmMatch: true,
            buildCost: 0,
            buildTime: 0,
            unique: false,
        },
        GATHERING_STATION: {
            id: 'gathering_station',
            name: 'Gathering Station',
            description: 'Collects food and seeds',
            defense: 150,
            jobSlots: 4,
            osmTypes: ['forest', 'wood'],
            strictOsmMatch: true,
            buildCost: 250,
            buildTime: 5000,
        },
        STORAGE: {
            id: 'storage',
            name: 'Storage Facility',
            description: 'Stores resources',
            defense: 150,
            storageCapacity: 200,
            osmTypes: ['warehouse', 'storage'],
            strictOsmMatch: true,
            buildCost: 300,
            buildTime: 8000,
        },
        STOREHOUSE: {
            id: 'storehouse',
            name: 'Storehouse',
            description: 'Basic resource storage built from repurposed structures',
            defense: 150,
            storageCapacity: 100,
            osmTypes: ['yes'],
            buildCost: 220,
            buildTime: 4500,
        },
        ARMORY: {
            id: 'armory',
            name: 'Armory',
            description: 'Military training facility',
            defense: 150,
            jobSlots: 3,
            osmTypes: ['barracks', 'bunker'],
            strictOsmMatch: true,
            buildCost: 400,
            scrapCost: 100,
            buildTime: 10000,
        },
        GUNSMITH: {
            id: 'gunsmith',
            name: 'Gunsmith',
            description: 'Crafts and maintains weapons to improve soldier effectiveness',
            defense: 150,
            jobSlots: 2,
            osmTypes: ['workshop', 'industrial'],
            strictOsmMatch: true,
            buildCost: 360,
            scrapCost: 80,
            toolCost: 4,
            buildTime: 9000,
        },
        RELIGIOUS: {
            id: 'religious',
            name: 'Religious Site',
            description: 'Provides spiritual guidance and stability',
            defense: 150,
            jobSlots: 2,
            osmTypes: ['place_of_worship', 'church', 'mosque', 'temple', 'synagogue'],
            strictOsmMatch: true,
            buildCost: 300,
            buildTime: 7000,
        },
        FORTIFICATION: {
            id: 'fortification',
            name: 'Fortification',
            description: 'Heavily defended military structure',
            defense: 1000,
            osmTypes: ['fort', 'fortress'],
            strictOsmMatch: true,
            buildCost: 500,
            scrapCost: 150,
            buildTime: 12000,
        },
        CASTLE_KEEP: {
            id: 'castle_keep',
            name: 'Castle Keep',
            description: 'Converted castle or bunker used for garrison command',
            defense: 850,
            jobSlots: 2,
            osmTypes: ['castle', 'bunker'],
            strictOsmMatch: true,
            buildCost: 520,
            scrapCost: 160,
            buildTime: 11800,
        },
        ENTERTAINMENT: {
            id: 'entertainment',
            name: 'Entertainment Venue',
            description: 'Theater, tavern, or gathering place for morale',
            defense: 150,
            jobSlots: 3,
            osmTypes: ['theatre', 'cinema'],
            strictOsmMatch: true,
            buildCost: 250,
            buildTime: 5000,
        },
        NIGHTCLUB: {
            id: 'nightclub',
            name: 'Nightclub Hall',
            description: 'Music-focused venue that boosts morale quickly',
            defense: 150,
            jobSlots: 2,
            osmTypes: ['nightclub'],
            strictOsmMatch: true,
            buildCost: 265,
            buildTime: 5200,
        },
        BREWERY: {
            id: 'brewery',
            name: 'Brewery',
            description: 'Produces beverages from seeds for happiness',
            defense: 150,
            jobSlots: 3,
            osmTypes: ['brewery'],
            strictOsmMatch: true,
            buildCost: 300,
            buildTime: 6000,
        },
        WORKSHOP: {
            id: 'workshop',
            name: 'Workshop',
            description: 'Builds tools and refines salvaged materials',
            defense: 150,
            jobSlots: 3,
            osmTypes: ['workshop', 'industrial'],
            strictOsmMatch: true,
            buildCost: 320,
            buildTime: 6500,
        },
        CLINIC: {
            id: 'clinic',
            name: 'Clinic',
            description: 'Improves morale through healthcare and support',
            defense: 150,
            jobSlots: 2,
            osmTypes: ['clinic', 'hospital'],
            strictOsmMatch: true,
            buildCost: 350,
            buildTime: 7000,
        },
        WATERWORKS: {
            id: 'waterworks',
            name: 'Waterworks',
            description: 'Improves irrigation and agricultural output',
            defense: 150,
            jobSlots: 3,
            osmTypes: ['water_tower', 'water_works'],
            strictOsmMatch: true,
            buildCost: 340,
            buildTime: 7000,
        },
        PUMPING_STATION: {
            id: 'pumping_station',
            name: 'Pumping Station',
            description: 'Water distribution site that supports crop reliability',
            defense: 150,
            jobSlots: 2,
            osmTypes: ['pumping_station'],
            strictOsmMatch: true,
            buildCost: 335,
            buildTime: 6900,
        },
        ORCHARD: {
            id: 'orchard',
            name: 'Orchard Estate',
            description: 'Seasonal fruit plots that produce food and some seeds',
            defense: 150,
            jobSlots: 3,
            osmTypes: ['orchard', 'vineyard'],
            strictOsmMatch: true,
            buildCost: 330,
            buildTime: 6500,
        },
        GREENHOUSE: {
            id: 'greenhouse',
            name: 'Greenhouse',
            description: 'Controlled growing environment for steady food and seed output',
            defense: 150,
            jobSlots: 3,
            osmTypes: ['greenhouse', 'glasshouse'],
            strictOsmMatch: true,
            buildCost: 360,
            buildTime: 7000,
        },
        HYDROPONICS_FARM: {
            id: 'hydroponics_farm',
            name: 'Hydroponics Farm',
            description: 'Tiny self-contained urban food system with morale benefits',
            defense: 150,
            jobSlots: 2,
            osmTypes: ['hydroponics', 'greenhouse_horticulture'],
            strictOsmMatch: true,
            buildCost: 380,
            buildTime: 7200,
        },
        COMMUNITY_KITCHEN: {
            id: 'community_kitchen',
            name: 'Community Kitchen',
            description: 'Repurposed building that produces a small amount of food',
            defense: 150,
            jobSlots: 2,
            osmTypes: ['yes'],
            buildCost: 280,
            buildTime: 5200,
        },
        SEED_DEPOT: {
            id: 'seed_depot',
            name: 'Seed Depot',
            description: 'Seed storage and propagation hub',
            defense: 150,
            jobSlots: 2,
            osmTypes: ['silo', 'granary'],
            strictOsmMatch: true,
            buildCost: 320,
            buildTime: 6200,
        },
        BARN_DEPOT: {
            id: 'barn_depot',
            name: 'Barn Depot',
            description: 'Barn conversion focused on local seed handling',
            defense: 150,
            jobSlots: 2,
            osmTypes: ['barn'],
            strictOsmMatch: true,
            buildCost: 300,
            buildTime: 6000,
        },
        URBAN_GARDEN: {
            id: 'urban_garden',
            name: 'Urban Garden',
            description: 'City allotment plots that yield modest food and seed stocks',
            defense: 150,
            jobSlots: 2,
            osmTypes: ['allotments', 'community_garden'],
            strictOsmMatch: true,
            buildCost: 300,
            buildTime: 5800,
        },
        MARKET_GARDEN: {
            id: 'market_garden',
            name: 'Market Garden',
            description: 'Small urban produce operation tied to local markets',
            defense: 150,
            jobSlots: 2,
            osmTypes: ['marketplace', 'farmers_market'],
            strictOsmMatch: true,
            buildCost: 320,
            buildTime: 6100,
        },
        NURSERY: {
            id: 'nursery',
            name: 'Plant Nursery',
            description: 'Specialized cultivation focused on high seed output',
            defense: 150,
            jobSlots: 2,
            osmTypes: ['garden_centre', 'plant_nursery'],
            strictOsmMatch: true,
            buildCost: 315,
            buildTime: 6000,
        },
        MILL: {
            id: 'mill',
            name: 'Mill',
            description: 'Converts large amounts of seeds into food',
            defense: 150,
            jobSlots: 4,
            osmTypes: ['mill'],
            strictOsmMatch: true,
            buildCost: 360,
            scrapCost: 50,
            toolCost: 5,
            buildTime: 7500,
        },
    },

    BUILDING_PROGRESSION: {
        tiers: {
            HQ: 1,
            HOUSE: 1,
            STOREHOUSE: 1,
            FARM: 1,
            GATHERING_STATION: 1,
            ARMORY: 1,
            ENTERTAINMENT: 1,
            RELIGIOUS: 1,
            WORKSHOP: 1,
            WATERWORKS: 1,

            COTTAGE_BLOCK: 2,
            HOSTEL: 3,
            APARTMENT_BUILDING: 4,

            STORAGE: 2,
            SEED_DEPOT: 2,
            BARN_DEPOT: 3,
            NURSERY: 4,

            ORCHARD: 2,
            URBAN_GARDEN: 2,
            MARKET_GARDEN: 3,
            GREENHOUSE: 3,
            HYDROPONICS_FARM: 4,
            COMMUNITY_KITCHEN: 2,
            MILL: 4,

            GUNSMITH: 2,
            CASTLE_KEEP: 3,
            FORTIFICATION: 4,

            NIGHTCLUB: 2,
            BREWERY: 2,
            CLINIC: 3,

            PUMPING_STATION: 4,
        },
        upgrades: {
            HOUSE: ['COTTAGE_BLOCK', 'STOREHOUSE', 'COMMUNITY_KITCHEN', 'ENTERTAINMENT', 'RELIGIOUS', 'WORKSHOP'],
            COTTAGE_BLOCK: ['HOSTEL'],
            HOSTEL: ['APARTMENT_BUILDING'],

            STOREHOUSE: ['STORAGE', 'SEED_DEPOT'],
            SEED_DEPOT: ['BARN_DEPOT'],
            BARN_DEPOT: ['NURSERY'],

            FARM: ['ORCHARD', 'URBAN_GARDEN', 'GREENHOUSE'],
            GATHERING_STATION: ['ORCHARD', 'SEED_DEPOT'],
            ORCHARD: ['MARKET_GARDEN', 'GREENHOUSE'],
            URBAN_GARDEN: ['MARKET_GARDEN'],
            MARKET_GARDEN: ['HYDROPONICS_FARM'],
            GREENHOUSE: ['HYDROPONICS_FARM'],
            COMMUNITY_KITCHEN: ['MILL'],

            ARMORY: ['GUNSMITH', 'CASTLE_KEEP'],
            GUNSMITH: ['FORTIFICATION'],
            CASTLE_KEEP: ['FORTIFICATION'],

            ENTERTAINMENT: ['NIGHTCLUB', 'BREWERY'],
            NIGHTCLUB: ['CLINIC'],
            BREWERY: ['CLINIC'],

            WORKSHOP: ['MILL', 'GUNSMITH', 'WATERWORKS'],
            WATERWORKS: ['PUMPING_STATION'],
            STORAGE: ['PUMPING_STATION'],
        },
    },
    
    // Job definitions
    JOBS: {
        FARMING: {
            id: 'farming',
            name: 'Farmer',
            building: 'farm',
            foodConsumption: 1, // food per second per citizen
            seedConsumption: 0.1, // seeds per second (small amount to sustain crops)
            foodProduction: 2, // food per second
            xpRate: 0.5,
        },
        GATHERING: {
            id: 'gathering',
            name: 'Gatherer',
            building: 'gathering_station',
            foodConsumption: 0.8,
            foodProduction: 1, // food per second
            seedProduction: 0.5, // seeds per second (increased from 0.3)
            xpRate: 0.4,
        },
        SCAVENGING: {
            id: 'scavenging',
            name: 'Scavenger',
            building: null, // No building required
            foodConsumption: 0.5,
            scrapProduction: 0.2, // scrap per second
            xpRate: 0.3,
        },
        MILITARY: {
            id: 'military',
            name: 'Soldier',
            building: 'armory',
            foodConsumption: 1.2,
            scrapConsumption: 0.1, // scrap for equipment maintenance
            xpRate: 0.6,
        },
        GUNSMITH: {
            id: 'gunsmith',
            name: 'Gunsmith',
            building: 'gunsmith',
            description: 'Improves soldier weapon quality and reliability',
            foodConsumption: 0.7,
            scrapConsumption: 0.25,
            xpRate: 0.5,
        },
        ENTERTAINMENT: {
            id: 'entertainment',
            name: 'Entertainer',
            building: 'entertainment',
            foodConsumption: 0.6,
            happinessProduction: 3.8,
            xpRate: 0.4,
        },
        NIGHT_HOST: {
            id: 'night_host',
            name: 'Night Host',
            building: 'nightclub',
            foodConsumption: 0.65,
            happinessProduction: 4.1,
            xpRate: 0.41,
        },
        BREWER: {
            id: 'brewer',
            name: 'Brewer',
            building: 'brewery',
            foodConsumption: 0.5,
            seedConsumption: 0.8, // seeds per second (main resource)
            happinessProduction: 3.1,
            xpRate: 0.4,
        },
        PRIEST: {
            id: 'priest',
            name: 'Clergy',
            building: 'religious',
            foodConsumption: 0.4,
            religiousnessProduction: 0.9,
            xpRate: 0.3,
        },
        ENGINEER: {
            id: 'engineer',
            name: 'Engineer',
            building: 'workshop',
            foodConsumption: 0.7,
            scrapConsumption: 0.35,
            toolsProduction: 0.4,
            xpRate: 0.45,
        },
        HEALER: {
            id: 'healer',
            name: 'Healer',
            building: 'clinic',
            foodConsumption: 0.6,
            happinessProduction: 2.6,
            xpRate: 0.35,
        },
        IRRIGATOR: {
            id: 'irrigator',
            name: 'Irrigation Worker',
            building: 'waterworks',
            foodConsumption: 0.6,
            seedProduction: 0.35,
            farmEfficiencyBonus: 0.08,
            xpRate: 0.4,
        },
        PUMP_OPERATOR: {
            id: 'pump_operator',
            name: 'Pump Operator',
            building: 'pumping_station',
            foodConsumption: 0.58,
            seedProduction: 0.3,
            farmEfficiencyBonus: 0.05,
            xpRate: 0.39,
        },
        ORCHARDER: {
            id: 'orcharder',
            name: 'Orchard Worker',
            building: 'orchard',
            foodConsumption: 0.7,
            seedConsumption: 0.12,
            foodProduction: 1.9,
            seedProduction: 0.2,
            xpRate: 0.42,
        },
        HORTICULTURIST: {
            id: 'horticulturist',
            name: 'Horticulturist',
            building: 'greenhouse',
            foodConsumption: 0.6,
            seedConsumption: 0.2,
            foodProduction: 1.4,
            seedProduction: 0.55,
            xpRate: 0.43,
        },
        HYDROPONICS_TECH: {
            id: 'hydroponics_tech',
            name: 'Hydroponics Tech',
            building: 'hydroponics_farm',
            foodConsumption: 0.45,
            foodProduction: 0.45,
            happinessProduction: 0.6,
            xpRate: 0.36,
        },
        KITCHEN_STAFF: {
            id: 'kitchen_staff',
            name: 'Kitchen Staff',
            building: 'community_kitchen',
            foodConsumption: 0.45,
            foodProduction: 0.75,
            xpRate: 0.34,
        },
        INNKEEPER: {
            id: 'innkeeper',
            name: 'Innkeeper',
            building: 'hostel',
            foodConsumption: 0.55,
            happinessProduction: 1.8,
            xpRate: 0.35,
        },
        COTTAGE_KEEPER: {
            id: 'cottage_keeper',
            name: 'Cottage Keeper',
            building: 'cottage_block',
            foodConsumption: 0.5,
            seedProduction: 0.15,
            xpRate: 0.33,
        },
        SEEDKEEPER: {
            id: 'seedkeeper',
            name: 'Seedkeeper',
            building: 'seed_depot',
            foodConsumption: 0.5,
            seedProduction: 0.95,
            xpRate: 0.4,
        },
        BARN_KEEPER: {
            id: 'barn_keeper',
            name: 'Barn Keeper',
            building: 'barn_depot',
            foodConsumption: 0.48,
            seedProduction: 0.7,
            xpRate: 0.37,
        },
        URBAN_FARMER: {
            id: 'urban_farmer',
            name: 'Urban Farmer',
            building: 'urban_garden',
            foodConsumption: 0.6,
            seedConsumption: 0.08,
            foodProduction: 1.2,
            seedProduction: 0.25,
            xpRate: 0.38,
        },
        MARKET_GROWER: {
            id: 'market_grower',
            name: 'Market Grower',
            building: 'market_garden',
            foodConsumption: 0.6,
            seedConsumption: 0.1,
            foodProduction: 1.35,
            seedProduction: 0.2,
            xpRate: 0.39,
        },
        NURSERY_KEEPER: {
            id: 'nursery_keeper',
            name: 'Nursery Keeper',
            building: 'nursery',
            foodConsumption: 0.5,
            seedProduction: 0.85,
            xpRate: 0.38,
        },
        MILLING: {
            id: 'milling',
            name: 'Miller',
            building: 'mill',
            foodConsumption: 0.8,
            seedConsumption: 1.4,
            foodProduction: 4.2,
            xpRate: 0.45,
        },
        CASTLE_WARDEN: {
            id: 'castle_warden',
            name: 'Castle Warden',
            building: 'castle_keep',
            foodConsumption: 0.95,
            scrapConsumption: 0.08,
            xpRate: 0.5,
        },
    },
    
    // Resource costs and requirements
    RESOURCES: {
        foodPerCitizen: 1, // food consumed per citizen per second
        storagePerFood: 1, // storage space per food unit
        storagePerSeed: 0.5,
        storagePerScrap: 0.3,
        storagePerTools: 0.4,
        storagePerSoldier: 0.6,
        bedsPerCitizen: 1, // beds needed per citizen
        birthRate: 0.01, // new citizens per existing citizen per second (very slow)
    },

    COMBAT: {
        baseSoldierDamage: 100,
        gunsmithBonusPerWorker: 0.12,
        maxGunsmithBonus: 0.96,
    },
    
    // Time system
    TIME: {
        secondsPerDay: 300, // 5 minutes real time = 1 game day
        daysPerWeek: 7,
        survivalDays: 7, // Citizens survive 1 week without food
    },
    
    // Happiness system
    HAPPINESS: {
        baseHappiness: 72,
        maxHappiness: 100,
        minHappiness: 0,
        starvingPenalty: -15,
        wellFedBonus: 22,
        housingPenalty: -8,
        arrivalThreshold: 35, // Reduced from 40 for easier recruitment
        arrivalCheckInterval: 10, // Check for arrivals every 10 seconds (was 60)
        arrivalChance: 0.5, // 50% chance per check when happy (was 30%)
        
        // Control-based happiness modifiers
        controlModifiers: {
            high: -10,
            medium: 0,
            low: 8,
            free: 24,
        },
        religionModifiers: {
            strict: -8,
            moderate: 4,
            tolerant: 10,
            none: 16,
        },
    },

    // Crime system
    CRIME: {
        checkInterval: 20, // seconds between crime checks
        baseChanceUnder50: 0.16,
        baseChanceOver50: 0.24,
        penaltyDecayPerSecond: 0.12,
        religionLevelMultiplier: {
            strict: 0.75,
            moderate: 1.0,
            tolerant: 1.1,
            none: 1.3,
        },
        controlImpactMultiplier: {
            high: 0.6,   // least happiness impact
            medium: 1.0, // same as free
            low: 1.5,    // highest happiness impact
            free: 1.0,
        },
        under50Types: [
            {
                key: 'theft',
                label: 'Theft',
                happinessPenalty: 4,
                citizenLossChance: 0.08,
            },
            {
                key: 'murder',
                label: 'Murder',
                happinessPenalty: 8,
                citizenLossChance: 0.35,
            },
        ],
        over50Types: [
            {
                key: 'theft',
                label: 'Theft',
                happinessPenalty: 4,
                citizenLossChance: 0.08,
            },
            {
                key: 'murder',
                label: 'Murder',
                happinessPenalty: 8,
                citizenLossChance: 0.35,
            },
            {
                key: 'fraud',
                label: 'Fraud',
                happinessPenalty: 5,
                citizenLossChance: 0.05,
            },
            {
                key: 'arson',
                label: 'Arson',
                happinessPenalty: 6,
                citizenLossChance: 0.12,
            },
            {
                key: 'assault',
                label: 'Assault',
                happinessPenalty: 6,
                citizenLossChance: 0.15,
            },
            {
                key: 'kidnapping',
                label: 'Kidnapping',
                happinessPenalty: 9,
                citizenLossChance: 0.3,
            },
            {
                key: 'organizedCrime',
                label: 'Organized Crime',
                happinessPenalty: 10,
                citizenLossChance: 0.22,
            },
            {
                key: 'riot',
                label: 'Riot',
                happinessPenalty: 11,
                citizenLossChance: 0.25,
            },
        ],
    },
    
    // Government system
    GOVERNMENT: {
        controlLevels: {
            high: {
                name: 'High Control',
                description: 'Direct job assignment, citizens cannot quit or leave',
                happinessMod: -20,
                playerControlsJobs: true,
                citizensCanQuit: false,
                citizensCanLeave: false,
                aiJobChange: false,
            },
            medium: {
                name: 'Medium Control',
                description: 'Assign jobs, but citizens may occasionally change roles',
                happinessMod: -5,
                playerControlsJobs: true,
                citizensCanQuit: true,
                citizensCanLeave: false,
                aiJobChange: false,
                jobChangeChance: 0.05, // 5% per check
            },
            low: {
                name: 'Low Control',
                description: 'Citizens often change jobs on their own',
                happinessMod: 5,
                playerControlsJobs: true,
                citizensCanQuit: true,
                citizensCanLeave: false,
                aiJobChange: true,
                jobChangeChance: 0.25, // 25% per check (was 15%)
            },
            free: {
                name: 'Free Control',
                description: 'Citizens fully autonomous, may claim buildings themselves',
                happinessMod: 15,
                playerControlsJobs: false,
                citizensCanQuit: true,
                citizensCanLeave: true,
                aiJobChange: true,
                jobChangeChance: 0.3, // 30% per check when working (was 20%)
                aiClaimBuilding: true,
                claimChance: 0.15, // 15% per check when needed (was 2%)
            },
        },
        stateReligionPenaltyPerCitizen: 0.35,
        religionLevels: {
            strict: {
                name: 'Strict Religious Control',
                description: 'State religion enforced, low tolerance',
                happinessMod: -15,
            },
            moderate: {
                name: 'Moderate Religious Policy',
                description: 'Official religion with some tolerance',
                happinessMod: 0,
            },
            tolerant: {
                name: 'Religious Tolerance',
                description: 'All religions accepted equally',
                happinessMod: 5,
            },
            none: {
                name: 'Secular State',
                description: 'No official religion, complete separation',
                happinessMod: 0,
            },
        },
        defaultControl: 'medium',
        defaultReligion: 'moderate',
    },
    
    // Demographics
    DEMOGRAPHICS: {
        ageGroups: {
            child: { min: 0, max: 17, weight: 0.2, canWork: false },
            adult: { min: 18, max: 64, weight: 0.65, canWork: true },
            elder: { min: 65, max: 90, weight: 0.15, canWork: false },
        },
        genders: ['Male', 'Female'],
        religions: [
            'Christianity', 'Islam', 'Buddhism', 'Hinduism', 'Judaism',
            'Sikhism', 'Atheist', 'Agnostic', 'Other'
        ],
        ethnicities: [
            'Asian', 'Black', 'Hispanic', 'Middle Eastern',
            'Native', 'Pacific Islander', 'White', 'Mixed'
        ],
    },

    RELIGION_BUILDINGS: {
        Christianity: 'Church',
        Islam: 'Mosque',
        Buddhism: 'Temple',
        Hinduism: 'Mandir',
        Judaism: 'Synagogue',
        Sikhism: 'Gurdwara',
        Atheist: 'Humanist Center',
        Agnostic: 'Philosophy Hall',
        Other: 'Shrine',
    },

    RELIGION_JOB_TITLES: {
        Christianity: 'Priest',
        Islam: 'Imam',
        Buddhism: 'Monk',
        Hinduism: 'Pandit',
        Judaism: 'Rabbi',
        Sikhism: 'Granthi',
        Atheist: 'Humanist',
        Agnostic: 'Seeker',
        Other: 'Clergy',
    },
    
    // Known famous houses and landmarks
    KNOWN_HOUSES: [
        {
            name: 'Graceland',
            location: [-90.008, 35.048], // Memphis, Tennessee
            beds: 23,
            description: 'Elvis Presley\'s mansion',
        },
        {
            name: 'White House',
            location: [-77.0369, 38.8951], // Washington, DC
            beds: 132,
            description: 'Official residence of the US President',
        },
        {
            name: 'Biltmore Estate',
            location: [-82.555, 35.543], // Asheville, North Carolina
            beds: 250,
            description: 'George Washington Vanderbilt II\'s mansion',
        },
        {
            name: 'Hearst Castle',
            location: [-121.167, 35.695], // San Simeon, California
            beds: 165,
            description: 'William Randolph Hearst\'s castle',
        },
        {
            name: 'Monticello',
            location: [-78.464, 38.010], // Charlottesville, Virginia
            beds: 43,
            description: 'Thomas Jefferson\'s plantation home',
        },
        {
            name: "Palace of Versailles",
            location: [2.122, 48.803], // Versailles, France
            beds: 226,
            description: 'Royal residence of Louis XIV',
        },
        {
            name: 'Buckingham Palace',
            location: [51.501, -0.141], // London, UK
            beds: 775,
            description: 'Official residence of the British monarch',
        },
        {
            name: 'Istana Nurul Iman',
            location: [114.921, 4.871], // Bandar Seri Begawan, Brunei
            beds: 1788,
            description: 'Official residence of the Sultan of Brunei',
        }
    ],
    
    // AI Civilizations presets
    AI_CIVILIZATIONS: [
        { name: 'The Eastern Empire', color: '#3b82f6' },
        { name: 'Western Coalition', color: '#ef4444' },
        { name: 'Northern Alliance', color: '#8b5cf6' },
        { name: 'Southern Confederation', color: '#f59e0b' },
        { name: 'Central Republic', color: '#14b8a6' },
    ],
};

// Merge onto window for easy access
window.CONFIG = CONFIG;

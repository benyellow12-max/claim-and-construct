// Resource management (XP, food, seeds, scrap, storage, beds)
const Resources = {
    lastUpdate: Date.now(),
    updateInterval: 100, // ms between updates
    
    init: () => {
        setInterval(Resources.update, Resources.updateInterval);
        Resources.updateUI();
        
        // AI simulation runs less frequently (every 30 seconds)
        // Run immediately on init, then every 30 seconds
        Resources.updateAIPlayers();
        setInterval(Resources.updateAIPlayers, 30000);
    },

    getPreferredReligion: (player, citizens) => {
        if (player && player.stateReligion) {
            return player.stateReligion;
        }

        if (citizens && citizens.length > 0) {
            const counts = {};
            citizens.forEach(c => {
                if (!c.religion) return;
                counts[c.religion] = (counts[c.religion] || 0) + 1;
            });

            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            if (sorted.length > 0) {
                return sorted[0][0];
            }
        }

        return CONFIG.DEMOGRAPHICS.religions[0];
    },
    
    update: () => {
        const player = Storage.getPlayer();
        if (!player) return;
        
        const now = Date.now();
        const deltaSeconds = (now - Resources.lastUpdate) / 1000;
        Resources.lastUpdate = now;
        
        const citizens = Storage.getCitizens();
        const allBuildings = Storage.getBuildings();
        // Only use player's buildings for resource calculations
        const buildings = allBuildings.filter(b => !b.ownerId || b.ownerId === 'player');
        
        // Initialize resources if needed
        if (player.food === undefined) player.food = CONFIG.initialFood;
        if (player.seeds === undefined) player.seeds = CONFIG.initialSeeds;
        if (player.scrap === undefined) player.scrap = CONFIG.initialScrap;
        if (player.tools === undefined) player.tools = 0;
        if (player.soldiers === undefined) player.soldiers = 0;
        if (player.citizens === undefined) player.citizens = CONFIG.initialCitizens;
        if (player.happiness === undefined) player.happiness = CONFIG.initialHappiness;
        if (player.gameTime === undefined) player.gameTime = 0;
        if (player.lastArrivalCheck === undefined) player.lastArrivalCheck = 0;
        if (player.lastCrimeCheck === undefined) player.lastCrimeCheck = 0;
        if (player.crimePenalty === undefined) player.crimePenalty = 0;
        if (player.stateReligion === undefined) player.stateReligion = null;
        if (player.religiousness === undefined) player.religiousness = 0;
        
        // Update game time
        player.gameTime += deltaSeconds;

        // Crime penalty decays over time
        if (player.crimePenalty > 0) {
            player.crimePenalty = Math.max(0, player.crimePenalty - (CONFIG.CRIME.penaltyDecayPerSecond * deltaSeconds));
        }
        
        // Calculate capacity requirements
        const totalBedsNeeded = citizens.length;
        const totalStorageNeeded = 
            (player.food * CONFIG.RESOURCES.storagePerFood) +
            (player.seeds * CONFIG.RESOURCES.storagePerSeed) +
            (player.scrap * CONFIG.RESOURCES.storagePerScrap) +
            ((player.tools || 0) * CONFIG.RESOURCES.storagePerTools) +
            ((player.soldiers || 0) * CONFIG.RESOURCES.storagePerSoldier);
        
        const totalBedsAvailable = Buildings.getTotalBeds();
        const totalStorageAvailable = Buildings.getTotalStorage();
        
        const bases = Storage.getBases();
        
        // Resource changes from jobs
        let foodConsumption = 0;
        let seedConsumption = 0;
        let foodProduction = 0;
        let seedProduction = 0;
        let scrapProduction = 0;
        let scrapConsumption = 0;
        let toolsProduction = 0;
        let farmingFoodProduction = 0;
        let seedDependentFoodProduction = 0;
        let activeIrrigators = 0;

        const jobCapacityByType = {};
        Object.entries(CONFIG.JOBS).forEach(([jobKey, jobDef]) => {
            const jobId = jobKey.toLowerCase();
            if (!jobDef.building) {
                jobCapacityByType[jobId] = { totalSlots: Infinity, workerCount: 0, utilization: 1 };
                return;
            }

            const matchingBuildings = buildings.filter(b => b.type.toLowerCase() === jobDef.building);
            const totalSlots = matchingBuildings.reduce((sum, building) => {
                if (building.jobSlots !== undefined) {
                    return sum + building.jobSlots;
                }
                const def = CONFIG.BUILDINGS[building.type];
                return sum + ((def && def.jobSlots) || 0);
            }, 0);

            const workerCount = citizens.filter(c => c.job === jobId).length;
            const utilization = workerCount > 0 ? Math.min(1, totalSlots / workerCount) : 0;
            jobCapacityByType[jobId] = { totalSlots, workerCount, utilization };
        });
        
        citizens.forEach(citizen => {
            if (citizen.job) {
                const jobDef = CONFIG.JOBS[citizen.job.toUpperCase()];
                if (!jobDef) return;
                const capacity = jobCapacityByType[citizen.job] || { utilization: 0 };
                const productionMultiplier = jobDef.building ? capacity.utilization : 1;
                
                // Consumption
                if (jobDef.foodConsumption) {
                    foodConsumption += jobDef.foodConsumption * deltaSeconds;
                }
                if (jobDef.seedConsumption) {
                    seedConsumption += jobDef.seedConsumption * deltaSeconds;
                }
                if (jobDef.scrapConsumption) {
                    scrapConsumption += jobDef.scrapConsumption * deltaSeconds;
                }
                
                // Production (scaled by total available capacity for this job type)
                if (productionMultiplier > 0) {
                    if (jobDef.foodProduction) {
                        const producedFood = jobDef.foodProduction * deltaSeconds * productionMultiplier;
                        foodProduction += producedFood;
                        if (jobDef.seedConsumption) {
                            seedDependentFoodProduction += producedFood;
                        }
                        if (citizen.job === 'farming') {
                            farmingFoodProduction += producedFood;
                        }
                    }
                    if (jobDef.seedProduction) {
                        seedProduction += jobDef.seedProduction * deltaSeconds * productionMultiplier;
                    }
                    if (jobDef.scrapProduction) {
                        scrapProduction += jobDef.scrapProduction * deltaSeconds * productionMultiplier;
                    }
                    if (jobDef.toolsProduction) {
                        toolsProduction += jobDef.toolsProduction * deltaSeconds * productionMultiplier;
                    }
                    if (citizen.job === 'irrigator') {
                        activeIrrigators += productionMultiplier;
                    }
                }
            } else {
                // Idle citizens still consume food
                foodConsumption += CONFIG.RESOURCES.foodPerCitizen * deltaSeconds;
            }
        });

        if (seedDependentFoodProduction > 0 && seedConsumption > 0) {
            const availableSeeds = Math.max(0, player.seeds + seedProduction);
            const seedScale = Math.min(1, availableSeeds / seedConsumption);

            if (seedScale < 1) {
                foodProduction -= seedDependentFoodProduction * (1 - seedScale);
                farmingFoodProduction *= seedScale;
            }
        }

        if (farmingFoodProduction > 0 && activeIrrigators > 0) {
            const bonusPerIrrigator = CONFIG.JOBS.IRRIGATOR?.farmEfficiencyBonus || 0;
            const totalIrrigationBonus = Math.min(1.5, activeIrrigators * bonusPerIrrigator);
            foodProduction += farmingFoodProduction * totalIrrigationBonus;
        }

        if (toolsProduction > 0 && scrapConsumption > 0) {
            const availableScrap = Math.max(0, player.scrap + scrapProduction);
            const scrapScale = Math.min(1, availableScrap / scrapConsumption);
            toolsProduction *= scrapScale;
        }
        
        // Calculate total storage capacity
        const totalStorage = Buildings.getTotalStorage();
        
        // Apply resource changes with storage cap
        player.food = Math.min(totalStorage, Math.max(0, player.food + (foodProduction - foodConsumption)));
        player.seeds = Math.min(totalStorage, Math.max(0, player.seeds + (seedProduction - seedConsumption)));
        player.scrap = Math.min(totalStorage, Math.max(0, player.scrap + (scrapProduction - scrapConsumption)));
        player.tools = Math.min(totalStorage, Math.max(0, player.tools + toolsProduction));
        player.soldiers = Math.max(0, player.soldiers || 0);

        // Enforce combined storage capacity across all resources
        const combinedStorageUsage =
            (player.food * CONFIG.RESOURCES.storagePerFood) +
            (player.seeds * CONFIG.RESOURCES.storagePerSeed) +
            (player.scrap * CONFIG.RESOURCES.storagePerScrap) +
            ((player.tools || 0) * CONFIG.RESOURCES.storagePerTools) +
            ((player.soldiers || 0) * CONFIG.RESOURCES.storagePerSoldier);

        if (totalStorage <= 0) {
            player.food = 0;
            player.seeds = 0;
            player.scrap = 0;
            player.tools = 0;
            player.soldiers = 0;
        } else if (combinedStorageUsage > totalStorage) {
            const storageScale = totalStorage / combinedStorageUsage;
            player.food *= storageScale;
            player.seeds *= storageScale;
            player.scrap *= storageScale;
            player.tools *= storageScale;
            player.soldiers *= storageScale;
        }

        const activePriests = citizens.filter(c => c.job === 'priest').length;
        const strictBaseReligiousness = player.religionLevel === 'strict' ? 20 : 0;
        player.religiousness = Math.max(0, Math.min(90, strictBaseReligiousness + activePriests));
        
        // Handle happiness production from all jobs that provide it (e.g., entertainer, brewer, healer)
        let happinessProduction = 0;
        citizens.forEach(citizen => {
            if (!citizen.job) return;
            const jobDef = CONFIG.JOBS[citizen.job.toUpperCase()];
            if (jobDef && jobDef.happinessProduction) {
                happinessProduction += jobDef.happinessProduction * deltaSeconds;
            }
        });
        
        // Calculate happiness
        const happiness = Resources.calculateHappiness(player, citizens, totalBedsNeeded, totalBedsAvailable, happinessProduction);
        player.happiness = Math.max(CONFIG.HAPPINESS.minHappiness, Math.min(CONFIG.HAPPINESS.maxHappiness, happiness));
        
        // Check for starvation (time-based survival)
        // Track how long food has been at zero
        if (player.food <= 0 && citizens.length > 0) {
            player.starvationTimer = (player.starvationTimer || 0) + deltaSeconds;
            
            // Only kill citizens after 2 game days (600 seconds) without food
            const starvationThreshold = CONFIG.TIME.secondsPerDay * 2;
            if (player.starvationTimer > starvationThreshold) {
                // Kill citizens gradually - about 10% per game day after threshold
                const deathRate = 0.1 / CONFIG.TIME.secondsPerDay; // 10% per day
                const citizensToDie = Math.max(1, Math.floor(citizens.length * deathRate * deltaSeconds));
                
                for (let i = 0; i < citizensToDie && citizens.length > 0; i++) {
                    Storage.removeCitizen(0); // Remove first citizen
                }
                if (citizensToDie > 0) {
                    Game.addLog(`${citizensToDie} citizens died from starvation!`, 'error');
                }
            }
        } else {
            // Reset starvation timer when food is available
            player.starvationTimer = 0;
        }
        
        // Check for natural citizen arrivals
        player.lastArrivalCheck += deltaSeconds;
        if (player.lastArrivalCheck >= CONFIG.HAPPINESS.arrivalCheckInterval) {
            player.lastArrivalCheck = 0;
            Resources.checkCitizenArrival(player, totalBedsNeeded, totalBedsAvailable);
        }

        // Crime events
        player.lastCrimeCheck += deltaSeconds;
        if (player.lastCrimeCheck >= CONFIG.CRIME.checkInterval) {
            player.lastCrimeCheck = 0;
            Resources.checkCrime(player, citizens);
        }
        
        // Check for AI job changes and building claims based on control level
        player.lastJobChangeCheck = (player.lastJobChangeCheck || 0) + deltaSeconds;
        const controlLevel = player.controlLevel || CONFIG.GOVERNMENT.defaultControl;
        const checkInterval = controlLevel === 'free' ? 15 : 30; // Free control checks more frequently
        
        if (player.lastJobChangeCheck >= checkInterval) {
            player.lastJobChangeCheck = 0;
            Resources.checkAIBehavior(player, citizens, buildings);
        }
        
        Storage.setPlayer(player);
        Resources.updateUI();
    },
    
    calculateHappiness: (player, citizens, bedsNeeded, bedsAvailable, happinessProduction = 0) => {
        let happiness = CONFIG.HAPPINESS.baseHappiness + (happinessProduction || 0);
        
        // Food situation
        const foodPerDay = CONFIG.RESOURCES.foodPerCitizen * citizens.length * CONFIG.TIME.secondsPerDay;
        const daysOfFood = player.food / (foodPerDay || 1);
        
        if (daysOfFood < CONFIG.TIME.survivalDays) {
            happiness += CONFIG.HAPPINESS.starvingPenalty;
        } else if (daysOfFood > 14) {
            happiness += CONFIG.HAPPINESS.wellFedBonus;
        }
        
        // Housing situation
        if (bedsNeeded > bedsAvailable) {
            happiness += CONFIG.HAPPINESS.housingPenalty;
        }
        
        // Government modifiers
        const controlLevel = player.controlLevel || CONFIG.GOVERNMENT.defaultControl;
        const religionLevel = player.religionLevel || CONFIG.GOVERNMENT.defaultReligion;
        
        happiness += CONFIG.HAPPINESS.controlModifiers[controlLevel] || 0;
        happiness += CONFIG.HAPPINESS.religionModifiers[religionLevel] || 0;
        if (religionLevel === 'strict' && player.stateReligion) {
            const differentFaiths = citizens.filter(c => c.religion && c.religion !== player.stateReligion).length;
            happiness -= differentFaiths * CONFIG.GOVERNMENT.stateReligionPenaltyPerCitizen;
        }
        happiness -= player.crimePenalty || 0;
        
        return happiness;
    },

    checkCrime: (player, citizens) => {
        if (!citizens || citizens.length === 0) return;

        const isUnder50 = citizens.length < 50;
        const crimePool = isUnder50 ? CONFIG.CRIME.under50Types : CONFIG.CRIME.over50Types;
        if (!crimePool || crimePool.length === 0) return;

        const controlLevel = player.controlLevel || CONFIG.GOVERNMENT.defaultControl;
        const controlMultiplier = CONFIG.CRIME.controlImpactMultiplier[controlLevel] ?? 1;
        const religionLevel = player.religionLevel || CONFIG.GOVERNMENT.defaultReligion;
        const religionMultiplier = CONFIG.CRIME.religionLevelMultiplier[religionLevel] ?? 1;

        const baseChance = isUnder50 ? CONFIG.CRIME.baseChanceUnder50 : CONFIG.CRIME.baseChanceOver50;
        const populationFactor = Math.min(0.25, citizens.length / 400);
        let crimeChance = Math.min(0.9, baseChance + populationFactor);
        crimeChance *= religionMultiplier;

        if (religionLevel === 'strict' && player.stateReligion) {
            const differentFaiths = citizens.filter(c => c.religion && c.religion !== player.stateReligion).length;
            const nonStateShare = differentFaiths / citizens.length;
            if (nonStateShare <= 0) {
                return;
            }
            crimeChance *= nonStateShare;
        }

        const religiousnessReduction = Math.min(0.9, (player.religiousness || 0) / 100);
        crimeChance *= (1 - religiousnessReduction);
        crimeChance = Math.min(0.9, crimeChance);

        if (Math.random() > crimeChance) return;

        const crime = crimePool[Math.floor(Math.random() * crimePool.length)];
        const happinessHit = crime.happinessPenalty * controlMultiplier;
        player.crimePenalty = (player.crimePenalty || 0) + happinessHit;

        let citizenLost = false;
        if (Math.random() < (crime.citizenLossChance || 0) && citizens.length > 0) {
            const victimIndex = Math.floor(Math.random() * citizens.length);
            Storage.removeCitizen(victimIndex);
            citizenLost = true;
        }

        const impactText = `Happiness -${happinessHit.toFixed(1)}`;
        if (citizenLost) {
            Game.addLog(`Crime wave: ${crime.label}. ${impactText}. 1 citizen was lost.`, 'error');
        } else {
            Game.addLog(`Crime wave: ${crime.label}. ${impactText}.`, 'warning');
        }
    },
    
    checkCitizenArrival: (player, bedsNeeded, bedsAvailable) => {
        // Citizens only arrive if HQ exists, happiness is high enough, and there's space
        const allBuildings = Storage.getBuildings();
        const buildings = allBuildings.filter(b => !b.ownerId || b.ownerId === 'player');
        const hqExists = buildings.some(b => b.type === 'HQ');
        
        if (!hqExists) {
            return; // No citizens until HQ is built
        }
        
        // Allow arrival if happiness is high enough AND there's at least one free bed
        if (player.happiness >= CONFIG.HAPPINESS.arrivalThreshold && bedsNeeded < bedsAvailable) {
            // Increase chance of arrival when happiness is very high
            const happinessBonus = Math.max(0, (player.happiness - CONFIG.HAPPINESS.arrivalThreshold) / 100);
            
            // Scale arrival chance with available beds (more beds = more arrivals)
            const freeBeds = bedsAvailable - bedsNeeded;
            const bedBonus = Math.min(0.3, freeBeds * 0.02); // Up to +30% for lots of free beds
            
            const arrivalChance = CONFIG.HAPPINESS.arrivalChance + happinessBonus + bedBonus;
            
            if (Math.random() < arrivalChance) {
                Storage.addCitizen(true); // true = exclude children from arrivals
                Game.addLog('A new citizen has arrived!', 'success');
            }
        }
    },
    
    checkAIBehavior: (player, citizens, buildings) => {
        const controlLevel = player.controlLevel || CONFIG.GOVERNMENT.defaultControl;
        const controlSettings = CONFIG.GOVERNMENT.controlLevels[controlLevel];
        
        if (!controlSettings) return;
        
        const isFreeGovernment = controlLevel === 'free';
        
        // Check food situation
        const foodCritical = player.food < citizens.length * 5; // Less than 5 seconds of food per citizen
        const foodLow = player.food < citizens.length * 30; // Less than 30 seconds of food per citizen
        
        // Check happiness situation
        const happinessLow = (player.happiness || 50) < 40; // Below 40 is low
        
        // AI job assignment/changes
        if (controlSettings.aiJobChange) {
            const idleCitizens = [];
            const workingCitizens = [];
            
            citizens.forEach((c, idx) => {
                if (c.ageGroup !== 'child' && c.ageGroup !== 'elder') {
                    if (!c.job) {
                        idleCitizens.push({ citizen: c, index: idx });
                    } else {
                        workingCitizens.push({ citizen: c, index: idx });
                    }
                }
            });
            
            // In free government, always assign jobs to idle citizens immediately
            if (isFreeGovernment && idleCitizens.length > 0) {
                console.log(`AI: ${idleCitizens.length} idle citizens, ${buildings.length} buildings`);
                idleCitizens.forEach(({index}) => {
                    Resources.aiChangeJob(index, citizens, buildings, player, foodCritical, foodLow, happinessLow);
                });
                // Persist the updated citizens
                Storage.setCitizens(citizens);
            }
            
            // For working citizens, allow job changes based on situation
            if (controlSettings.jobChangeChance) {
                workingCitizens.forEach(({index}) => {
                    // Increase change chance if food is critical
                    const changeChance = foodCritical ? controlSettings.jobChangeChance * 2 : controlSettings.jobChangeChance;
                    
                    if (Math.random() < changeChance) {
                        Resources.aiChangeJob(index, citizens, buildings, player, foodCritical, foodLow, happinessLow);
                    }
                });
            }
        }
        
        // AI building claims (free control only)
        if (isFreeGovernment && controlSettings.aiClaimBuilding && controlSettings.claimChance) {
            console.log('AI: Checking for building claims...');
            Resources.aiClaimBuilding(player, citizens, buildings, foodCritical, foodLow, controlSettings.claimChance);
        }
    },
    
    aiClaimBuilding: (player, citizens, playerBuildings, foodCritical, foodLow, baseClaimChance) => {
        // Only work with player's buildings
        const buildings = playerBuildings;
        // Check if HQ exists - if not, prioritize claiming one
        const hqExists = buildings.some(b => b.type === 'HQ');
        
        console.log(`AI Claim: HQ exists: ${hqExists}, citizens: ${citizens.length}, buildings: ${buildings.length}`);
        
        // Determine what types of buildings we need (ranked list)
        let buildingTypeNeeded = null;
        let priority = 0;
        const claimCandidates = [];
        const claimCandidateSet = new Set();

        const addCandidate = (type, score) => {
            if (!type || claimCandidateSet.has(type)) return;
            claimCandidateSet.add(type);
            claimCandidates.push({ type, priority: score });
        };
        
        if (!hqExists) {
            buildingTypeNeeded = 'HQ';
            priority = 5; // High priority
        } else {
            const totalBeds = buildings.reduce((sum, building) => sum + (building.beds || 0), 0);
            const housingNeeded = citizens.length >= totalBeds;
            const religiousness = player.religiousness || 0;
            const religiousnessLow = religiousness < 35;
            const religionLevel = player.religionLevel || CONFIG.GOVERNMENT.defaultReligion;
            const tools = player.tools || 0;
            
            // Check seed levels (more aggressive - check much earlier)
            const seedsLow = player.seeds < citizens.length * 5; // Less than 5 seconds of production buffer
            const seedsCritical = player.seeds < citizens.length * 2; // Less than 2 seconds is critical
            
            // Check happiness levels
            const happinessLow = (player.happiness || 50) < 40; // Below 40 is low
            
            // Check storage capacity - high priority if near full
            const totalStorage = player.isAI
                ? buildings.reduce((sum, building) => sum + (building.storage || 0), 0)
                : Buildings.getTotalStorage();
            const totalResources = player.food + player.seeds + player.scrap + (player.tools || 0);
            const storageUsagePercent = totalStorage > 0 ? (totalResources / totalStorage) : 1;
            const storageNearFull = storageUsagePercent > 0.8; // 80% capacity
            console.log(`Storage usage: ${(storageUsagePercent * 100).toFixed(1)}% (${totalResources}/${totalStorage}), Seeds: ${player.seeds}, Happiness: ${player.happiness}`);
            
            // Count food production buildings
            const foodBuildings = buildings.filter(b =>
                b.type === 'FARM' ||
                b.type === 'GATHERING_STATION' ||
                b.type === 'MILL' ||
                b.type === 'ORCHARD' ||
                b.type === 'GREENHOUSE' ||
                b.type === 'HYDROPONICS_FARM' ||
                b.type === 'URBAN_GARDEN' ||
                b.type === 'MARKET_GARDEN'
            ).length;
            const needMoreFoodBuildings = foodBuildings < Math.max(2, Math.floor(citizens.length / 5));

            const workshopBuildings = buildings.filter(b => b.type === 'WORKSHOP').length;
            const clinicBuildings = buildings.filter(b => b.type === 'CLINIC').length;
            const waterworksBuildings = buildings.filter(b => b.type === 'WATERWORKS' || b.type === 'PUMPING_STATION').length;
            const apartmentBuildings = buildings.filter(b => b.type === 'APARTMENT_BUILDING').length;
            const hostelBuildings = buildings.filter(b => b.type === 'HOSTEL').length;
            const cottageBuildings = buildings.filter(b => b.type === 'COTTAGE_BLOCK').length;
            const storageBuildings = buildings.filter(b => b.type === 'STORAGE').length;
            const storehouseBuildings = buildings.filter(b => b.type === 'STOREHOUSE').length;
            const communityKitchenBuildings = buildings.filter(b => b.type === 'COMMUNITY_KITCHEN').length;
            const toolsLow = tools < Math.max(8, citizens.length * 2);
            const foodAbundant = player.food > Math.max(150, citizens.length * 90);
            const seedsForMilling = player.seeds > Math.max(120, citizens.length * 45);
            const needWorkshopBuildings = workshopBuildings < Math.max(1, Math.floor(citizens.length / 20));
            const needClinicBuildings = clinicBuildings < Math.max(1, Math.floor(citizens.length / 18));
            const needWaterworksBuildings = waterworksBuildings < Math.max(1, Math.floor(citizens.length / 16));
            const needApartmentBuildings = apartmentBuildings < Math.max(1, Math.floor(citizens.length / 24));
            const needHostelBuildings = hostelBuildings < Math.max(1, Math.floor(citizens.length / 28));
            const needCottageBuildings = cottageBuildings < Math.max(1, Math.floor(citizens.length / 26));
            const needStorehouseBuildings = storehouseBuildings < Math.max(1, Math.floor(citizens.length / 26));
            const needCommunityKitchenBuildings = communityKitchenBuildings < Math.max(1, Math.floor(citizens.length / 30));
            const hasStrictStorage = storageBuildings > 0;
            const millBuildings = buildings.filter(b => b.type === 'MILL').length;
            const orchardBuildings = buildings.filter(b => b.type === 'ORCHARD').length;
            const greenhouseBuildings = buildings.filter(b => b.type === 'GREENHOUSE').length;
            const hydroponicsBuildings = buildings.filter(b => b.type === 'HYDROPONICS_FARM').length;
            const seedDepotBuildings = buildings.filter(b => b.type === 'SEED_DEPOT' || b.type === 'BARN_DEPOT').length;
            const urbanGardenBuildings = buildings.filter(b => b.type === 'URBAN_GARDEN').length;
            const marketGardenBuildings = buildings.filter(b => b.type === 'MARKET_GARDEN').length;
            const nurseryBuildings = buildings.filter(b => b.type === 'NURSERY').length;
            const needMillBuildings = millBuildings < Math.max(1, Math.floor(citizens.length / 14));
            const needOrchardBuildings = orchardBuildings < Math.max(1, Math.floor(citizens.length / 18));
            const needGreenhouseBuildings = greenhouseBuildings < Math.max(1, Math.floor(citizens.length / 16));
            const needHydroponicsBuildings = hydroponicsBuildings < Math.max(1, Math.floor(citizens.length / 28));
            const needSeedDepotBuildings = seedDepotBuildings < Math.max(1, Math.floor(citizens.length / 22));
            const needUrbanFoodBuildings = (urbanGardenBuildings + marketGardenBuildings) < Math.max(1, Math.floor(citizens.length / 20));
            const needNurseryBuildings = nurseryBuildings < Math.max(1, Math.floor(citizens.length / 24));
            
            // Count happiness buildings (entertainment and brewery)
            const happinessBuildings = buildings.filter(b => b.type === 'ENTERTAINMENT' || b.type === 'NIGHTCLUB' || b.type === 'BREWERY').length;
            const needMoreHappinessBuildings = happinessBuildings < Math.max(1, Math.floor(citizens.length / 10));
            
            // Prioritize based on needs
            if (housingNeeded) {
                // When beds are full, prioritize housing above all other non-HQ needs
                if (needApartmentBuildings) {
                    buildingTypeNeeded = 'APARTMENT_BUILDING';
                } else if (needHostelBuildings) {
                    buildingTypeNeeded = 'HOSTEL';
                } else if (needCottageBuildings) {
                    buildingTypeNeeded = 'COTTAGE_BLOCK';
                } else {
                    buildingTypeNeeded = 'HOUSE';
                }
                priority = 4.9;
            } else if (seedsCritical && needWaterworksBuildings) {
                // Critical seed pressure: prioritize irrigation infrastructure
                buildingTypeNeeded = Math.random() < 0.6 ? 'WATERWORKS' : 'PUMPING_STATION';
                priority = 4.55;
            } else if (storageNearFull) {
                // Prefer strict storage first; generic building=yes storage fallback is lower
                buildingTypeNeeded = hasStrictStorage ? 'STORAGE' : (needStorehouseBuildings ? 'STOREHOUSE' : 'STORAGE');
                priority = 4.5; // High priority when storage is full
            } else if (happinessLow && needClinicBuildings && !foodCritical) {
                // Low happiness: clinics are the first response when available
                buildingTypeNeeded = 'CLINIC';
                priority = 4.15;
            } else if (happinessLow && needMoreHappinessBuildings && !foodCritical) {
                // Low happiness - prioritize happiness buildings (brewery uses seeds, entertainment doesn't)
                if (seedsLow) {
                    buildingTypeNeeded = Math.random() < 0.55 ? 'ENTERTAINMENT' : 'NIGHTCLUB';
                } else {
                    buildingTypeNeeded = Math.random() < 0.55 ? 'BREWERY' : 'NIGHTCLUB';
                }
                priority = 3.9;
            } else if (foodCritical) {
                buildingTypeNeeded = Math.random() < 0.4 ? 'FARM' : 'GATHERING_STATION';
                priority = 4;
            } else if (seedsCritical) {
                // Seeds are critical - gathering is highest priority after food
                const seedChoices = ['GATHERING_STATION'];
                if (needSeedDepotBuildings) seedChoices.push('SEED_DEPOT');
                if (needSeedDepotBuildings) seedChoices.push('BARN_DEPOT');
                if (needNurseryBuildings) seedChoices.push('NURSERY');
                buildingTypeNeeded = seedChoices[Math.floor(Math.random() * seedChoices.length)];
                priority = 3.9;
            } else if (seedsLow && needWaterworksBuildings) {
                buildingTypeNeeded = Math.random() < 0.6 ? 'WATERWORKS' : 'PUMPING_STATION';
                priority = 3.85;
            } else if (seedsLow && !foodLow) {
                // Seeds are low but food is fine - prioritize gathering stations
                const seedChoices = ['GATHERING_STATION'];
                if (needSeedDepotBuildings) seedChoices.push('SEED_DEPOT');
                if (needSeedDepotBuildings) seedChoices.push('BARN_DEPOT');
                buildingTypeNeeded = seedChoices[Math.floor(Math.random() * seedChoices.length)];
                priority = 3.8;
            } else if (!foodCritical && !foodLow && needUrbanFoodBuildings) {
                buildingTypeNeeded = Math.random() < 0.55 ? 'URBAN_GARDEN' : 'MARKET_GARDEN';
                priority = 3.75;
            } else if (foodAbundant && seedsForMilling && needMillBuildings && !foodCritical) {
                // In abundance, expand higher-throughput seed-to-food conversion
                buildingTypeNeeded = 'MILL';
                priority = 3.7;
            } else if (!foodCritical && !seedsCritical && needGreenhouseBuildings) {
                buildingTypeNeeded = 'GREENHOUSE';
                priority = 3.65;
            } else if (!foodCritical && !foodLow && !seedsLow && needHydroponicsBuildings) {
                buildingTypeNeeded = 'HYDROPONICS_FARM';
                priority = 3.55;
            } else if (!foodCritical && !foodLow && needCommunityKitchenBuildings) {
                // Generic building=yes food building should stay below specific food infrastructure
                buildingTypeNeeded = 'COMMUNITY_KITCHEN';
                priority = 3.2;
            } else if (!foodCritical && !foodLow && needOrchardBuildings) {
                buildingTypeNeeded = 'ORCHARD';
                priority = 3.5;
            } else if (toolsLow && needWorkshopBuildings && !foodCritical) {
                buildingTypeNeeded = 'WORKSHOP';
                priority = 3.4;
            } else if (foodLow || needMoreFoodBuildings) {
                const foodChoices = ['FARM', 'GATHERING_STATION', 'ORCHARD', 'GREENHOUSE', 'HYDROPONICS_FARM'];
                buildingTypeNeeded = foodChoices[Math.floor(Math.random() * foodChoices.length)];
                priority = 3;
            } else if (religionLevel !== 'none' && religiousnessLow) {
                // Religious buildings are important, but lower priority than food expansion
                buildingTypeNeeded = 'RELIGIOUS';
                priority = 2.7;
            } else if (Math.random() < 0.5) {
                // Higher chance of expansion - prioritize houses and gathering sites
                const rand = Math.random();
                if (rand < 0.42) {
                    buildingTypeNeeded = 'HOUSE';
                } else if (rand < 0.52) {
                    buildingTypeNeeded = 'COTTAGE_BLOCK';
                } else if (rand < 0.60) {
                    buildingTypeNeeded = 'HOSTEL';
                } else if (rand < 0.68) {
                    buildingTypeNeeded = 'APARTMENT_BUILDING';
                } else if (rand < 0.74) {
                    buildingTypeNeeded = 'GATHERING_STATION';
                } else if (rand < 0.82) {
                    buildingTypeNeeded = 'FARM';
                } else if (rand < 0.87) {
                    buildingTypeNeeded = 'STORAGE';
                } else if (rand < 0.90) {
                    buildingTypeNeeded = 'CLINIC';
                } else if (rand < 0.93) {
                    buildingTypeNeeded = 'WATERWORKS';
                } else if (rand < 0.945) {
                    buildingTypeNeeded = 'PUMPING_STATION';
                } else if (rand < 0.957) {
                    buildingTypeNeeded = 'ORCHARD';
                } else if (rand < 0.967) {
                    buildingTypeNeeded = 'GREENHOUSE';
                } else if (rand < 0.973) {
                    buildingTypeNeeded = 'HYDROPONICS_FARM';
                } else if (rand < 0.979) {
                    buildingTypeNeeded = 'URBAN_GARDEN';
                } else if (rand < 0.984) {
                    buildingTypeNeeded = 'MARKET_GARDEN';
                } else if (rand < 0.988) {
                    buildingTypeNeeded = 'SEED_DEPOT';
                } else if (rand < 0.991) {
                    buildingTypeNeeded = 'BARN_DEPOT';
                } else if (rand < 0.993) {
                    buildingTypeNeeded = 'NURSERY';
                } else if (rand < 0.995) {
                    buildingTypeNeeded = 'MILL';
                } else if (rand < 0.997) {
                    buildingTypeNeeded = 'WORKSHOP';
                } else if (rand < 0.998) {
                    buildingTypeNeeded = Math.random() < 0.5 ? 'ENTERTAINMENT' : 'NIGHTCLUB';
                } else if (rand < 0.999) {
                    // Generic building=yes options are intentionally lowest-priority
                    buildingTypeNeeded = Math.random() < 0.5 ? 'STOREHOUSE' : 'COMMUNITY_KITCHEN';
                } else if (religionLevel === 'none' && religiousnessLow && rand < 0.995) {
                    // Secular societies only prioritize religious buildings over fortifications when low
                    buildingTypeNeeded = 'RELIGIOUS';
                } else {
                    // Lowest-priority expansion pick
                    buildingTypeNeeded = Math.random() < 0.5 ? 'FORTIFICATION' : 'CASTLE_KEEP';
                }
                priority = 2.2; // Increased from 1 to make expansion more aggressive
            }

            if (housingNeeded) {
                addCandidate('APARTMENT_BUILDING', 4.8);
                addCandidate('HOSTEL', 4.7);
                addCandidate('COTTAGE_BLOCK', 4.65);
                addCandidate('HOUSE', 4.6);
            }

            if (storageNearFull) {
                addCandidate('STORAGE', 4.4);
                addCandidate('STOREHOUSE', 3.2);
            }

            if (foodCritical || foodLow || needMoreFoodBuildings) {
                addCandidate('GATHERING_STATION', 4.0);
                addCandidate('FARM', 3.9);
                addCandidate('ORCHARD', 3.4);
                addCandidate('GREENHOUSE', 3.3);
                addCandidate('HYDROPONICS_FARM', 3.2);
                addCandidate('COMMUNITY_KITCHEN', 2.2);
            }

            if (seedsCritical || seedsLow) {
                addCandidate('SEED_DEPOT', 3.9);
                addCandidate('BARN_DEPOT', 3.85);
                addCandidate('NURSERY', 3.8);
                addCandidate('WATERWORKS', 3.7);
                addCandidate('PUMPING_STATION', 3.65);
            }

            if (foodAbundant && seedsForMilling) {
                addCandidate('MILL', 3.8);
            }

            if (happinessLow) {
                addCandidate('CLINIC', 3.9);
                addCandidate('ENTERTAINMENT', 3.2);
                addCandidate('NIGHTCLUB', 3.1);
            }

            if (toolsLow) {
                addCandidate('WORKSHOP', 3.5);
                addCandidate('GUNSMITH', 2.6);
            }

            if (religionLevel !== 'none' && religiousnessLow) {
                addCandidate('RELIGIOUS', 2.8);
            }

            // Lowest-priority generic expansion options
            addCandidate('STOREHOUSE', 1.8);
            addCandidate('COMMUNITY_KITCHEN', 1.7);
            addCandidate('FORTIFICATION', 1.5);
            addCandidate('CASTLE_KEEP', 1.45);
        }

        if (buildingTypeNeeded) {
            addCandidate(buildingTypeNeeded, priority);
        }

        if (claimCandidates.length === 0) {
            console.log('AI Claim: No building type needed');
            return;
        }

        const now = Date.now();
        const unavailableCooldownMs = 180000; // 3 minutes
        const claimCooldowns = player.aiClaimCooldowns || {};

        // Remove expired cooldowns
        Object.keys(claimCooldowns).forEach((type) => {
            if (!claimCooldowns[type] || claimCooldowns[type] <= now) {
                delete claimCooldowns[type];
            }
        });

        const sortedCandidates = claimCandidates
            .sort((a, b) => b.priority - a.priority)
            .filter((candidate) => !claimCooldowns[candidate.type]);

        if (sortedCandidates.length === 0) {
            player.aiClaimCooldowns = claimCooldowns;
            console.log('AI Claim: All desired building types are on cooldown');
            return;
        }

        const topPriority = sortedCandidates[0].priority || 1;
        const claimChance = Math.min(1, baseClaimChance * 10 * topPriority); // 10x multiplier, cap at 100%

        console.log(`AI Claim: Ranked targets ${sortedCandidates.map(c => `${c.type}:${c.priority.toFixed(2)}`).join(', ')}`);
        console.log(`AI Claim: Top priority ${topPriority.toFixed(2)}, claim chance: ${claimChance.toFixed(2)} (base: ${baseClaimChance})`);

        if (Math.random() > claimChance) {
            console.log(`AI Claim: Random check failed (need < ${claimChance})`);
            return;
        }

        let claimedType = null;
        for (const candidate of sortedCandidates) {
            console.log(`AI Claim: Attempting target ${candidate.type}`);
            const claimResult = Resources.findAndClaimOSMFeature(candidate.type, player);

            if (claimResult && claimResult.claimed) {
                claimedType = candidate.type;
                delete claimCooldowns[candidate.type];
                break;
            }

            if (claimResult && (claimResult.reason === 'no_features' || claimResult.reason === 'no_source')) {
                claimCooldowns[candidate.type] = now + unavailableCooldownMs;
            }
        }

        player.aiClaimCooldowns = claimCooldowns;

        if (claimedType) {
            const buildingDef = CONFIG.BUILDINGS[claimedType];
            Game.addLog(`Citizens have claimed a ${buildingDef.name}!`, 'success');
        } else {
            console.log('AI Claim: No claim succeeded this cycle');
        }
    },
    
    findAndClaimOSMFeature: (buildingType, player) => {
        const isAIPlayer = !!(player && player.isAI);
        const allBuildings = Storage.getBuildings();
        const ownedBuildings = allBuildings.filter((building) => {
            if (!Array.isArray(building.location) || building.location.length < 2) return false;
            if (isAIPlayer) return building.ownerId === player.name;
            return !building.ownerId || building.ownerId === 'player';
        });

        const sourceFeatures = isAIPlayer
            ? Resources.ensureAIOsmFeatures(player, ownedBuildings)
            : ((window.OSMManager && OSMManager.osmFeatures) ? OSMManager.osmFeatures : []);

        if (!sourceFeatures || sourceFeatures.length === 0) {
            console.log('AI Claim: No OSM features available yet');
            return { claimed: false, reason: 'no_source' };
        }

        console.log(`AI Claim: Searching for ${buildingType} among ${sourceFeatures.length} features`);

        const buildingDef = CONFIG.BUILDINGS[buildingType];
        if (!buildingDef || !buildingDef.osmTypes) {
            console.log('AI Claim: Invalid building definition');
            return { claimed: false, reason: 'invalid_type' };
        }
        
        // Get already claimed building OSM IDs
        const claimedIds = new Set(Storage.getBuildings().map(b => String(b.osmId)));
        
        // Define which OSM tag keys are relevant for each building type
        const tagKeysForBuilding = {
            'HQ': ['building', 'yes'],
            'HOUSE': ['building', 'yes'],
            'COTTAGE_BLOCK': ['building'],
            'APARTMENT_BUILDING': ['building'],
            'HOSTEL': ['building', 'tourism'],
            'FARM': ['landuse'],
            'GATHERING_STATION': ['natural'],
            'STORAGE': ['building', 'shop'],
            'STOREHOUSE': ['building'],
            'ARMORY': ['building'],
            'GUNSMITH': ['building', 'industrial'],
            'FORTIFICATION': ['building'],
            'CASTLE_KEEP': ['building', 'historic'],
            'RELIGIOUS': ['amenity', 'building'],
            'WORKSHOP': ['building', 'industrial'],
            'CLINIC': ['amenity', 'building'],
            'WATERWORKS': ['man_made', 'building'],
            'PUMPING_STATION': ['man_made', 'building'],
            'ENTERTAINMENT': ['amenity'],
            'NIGHTCLUB': ['amenity'],
            'BREWERY': ['building'],
            'COMMUNITY_KITCHEN': ['building'],
            'MILL': ['building', 'industrial', 'man_made'],
            'ORCHARD': ['landuse'],
            'GREENHOUSE': ['building'],
            'HYDROPONICS_FARM': ['building'],
            'SEED_DEPOT': ['building'],
            'BARN_DEPOT': ['building'],
            'URBAN_GARDEN': ['landuse', 'leisure'],
            'MARKET_GARDEN': ['amenity'],
            'NURSERY': ['shop', 'building'],
        };
        
        // Get the relevant tag keys for this building type
        const relevantKeys = tagKeysForBuilding[buildingType] || [];
        
        // Filter available features that match this building type
        const availableFeatures = sourceFeatures.map((osmFeature) => {
            // Skip already claimed
            if (claimedIds.has(String(osmFeature.id))) return null;
            
            // Skip known houses (special)
            if (osmFeature.isKnownHouse) return null;
            
            // Check if this OSM feature matches the building's required types
            const tags = osmFeature.tags || {};
            const buildingTag = tags.building ? String(tags.building).toLowerCase() : '';

            // building=yes only works for non-strict building definitions
            if (buildingTag === 'yes' && !buildingDef.strictOsmMatch) {
                return {
                    osmFeature,
                    matchPriority: 1, // lower priority than specific type matches
                };
            }
            
            // Only check relevant tag keys for this building type
            const matchedTagValues = [];
            relevantKeys.forEach(key => {
                if (tags[key]) {
                    matchedTagValues.push(String(tags[key]).toLowerCase());
                }
            });
            
            // Check if any matched tag value is in the building's acceptable types
            const allowedTypes = (buildingDef.osmTypes || []).map(type => String(type).toLowerCase());
            const isMatch = matchedTagValues.some(tagValue => 
                allowedTypes.includes(tagValue)
            );
            
            if (isMatch) {
                console.log(`AI Claim: Matched ${buildingType} - feature ${osmFeature.id} with tags:`, tags);
                return {
                    osmFeature,
                    matchPriority: 0,
                };
            }
            
            return null;
        }).filter(Boolean);
        
        console.log(`AI Claim: Found ${availableFeatures.length} available features for ${buildingType}`);
        
        if (availableFeatures.length === 0) {
            return { claimed: false, reason: 'no_features' };
        }

        const getFeatureLocation = (osmFeature) => {
            if (!osmFeature || !osmFeature.geometry) return null;

            if (osmFeature.geometry.lat !== undefined && osmFeature.geometry.lon !== undefined) {
                return [osmFeature.geometry.lon, osmFeature.geometry.lat];
            }

            if (osmFeature.geometry.center && osmFeature.geometry.center.lon !== undefined && osmFeature.geometry.center.lat !== undefined) {
                return [osmFeature.geometry.center.lon, osmFeature.geometry.center.lat];
            }

            if (Array.isArray(osmFeature.geometry) && osmFeature.geometry.length > 0) {
                let lonSum = 0;
                let latSum = 0;
                let count = 0;
                osmFeature.geometry.forEach((node) => {
                    if (node && node.lon !== undefined && node.lat !== undefined) {
                        lonSum += node.lon;
                        latSum += node.lat;
                        count += 1;
                    }
                });

                if (count > 0) {
                    return [lonSum / count, latSum / count];
                }
            }

            return null;
        };

        const hqBuilding = ownedBuildings.find((building) => building.type === 'HQ');
        const referenceLocations = hqBuilding
            ? [hqBuilding.location]
            : [CONFIG.mapCenter || [0, 0]];

        const distanceSquared = (a, b) => {
            const dx = a[0] - b[0];
            const dy = a[1] - b[1];
            return dx * dx + dy * dy;
        };

        // Pick the closest feature first instead of random
        const sortedFeatures = [...availableFeatures].sort((featureA, featureB) => {
            if (featureA.matchPriority !== featureB.matchPriority) {
                return featureA.matchPriority - featureB.matchPriority;
            }

            const locationA = getFeatureLocation(featureA.osmFeature);
            const locationB = getFeatureLocation(featureB.osmFeature);

            const minDistanceA = locationA
                ? Math.min(...referenceLocations.map((referenceLocation) => distanceSquared(locationA, referenceLocation)))
                : Number.POSITIVE_INFINITY;
            const minDistanceB = locationB
                ? Math.min(...referenceLocations.map((referenceLocation) => distanceSquared(locationB, referenceLocation)))
                : Number.POSITIVE_INFINITY;

            return minDistanceA - minDistanceB;
        });
        
        const chosenFeature = sortedFeatures[0].osmFeature;
        
        // Get feature properties
        const tags = chosenFeature.tags || {};
        const name = tags.name || `${buildingDef.name} ${Math.floor(Math.random() * 1000)}`;
        
        // Get location from geometry
        let location = [0, 0];
        const chosenLocation = getFeatureLocation(chosenFeature);
        if (chosenLocation) {
            location = chosenLocation;
        }
        
        // Determine beds for housing
        let beds = buildingDef.bedsMin || 0;
        if (buildingDef.bedsMax) {
            beds = Math.floor(Math.random() * (buildingDef.bedsMax - buildingDef.bedsMin + 1)) + buildingDef.bedsMin;
        }
        
        // Check if we can afford it
        const scrapCost = buildingDef.scrapCost || 0;
        const toolCost = buildingDef.toolCost || 0;
        if (player.scrap < scrapCost) {
            console.log(`AI Claim: Cannot afford ${buildingType}, need ${scrapCost} scrap, have ${player.scrap}`);
            return { claimed: false, reason: 'insufficient_scrap' };
        }
        if ((player.tools || 0) < toolCost) {
            console.log(`AI Claim: Cannot afford ${buildingType}, need ${toolCost} tools, have ${player.tools || 0}`);
            return { claimed: false, reason: 'insufficient_tools' };
        }
        
        console.log(`AI Claim: Attempting to claim ${name} (${buildingType}) at ${location}`);
        
        // Claim the building
        const properties = {
            location: location,
            beds: beds,
            storage: buildingDef.storageCapacity || 0,
            sourceTags: tags,
        };

        if (buildingType === 'RELIGIOUS') {
            properties.religion = Resources.getPreferredReligion(player, Storage.getCitizens());
        }

        if (isAIPlayer) {
            player.scrap = Math.max(0, (player.scrap || 0) - scrapCost);
            player.tools = Math.max(0, (player.tools || 0) - toolCost);

            const building = Storage.addBuilding({
                osmId: chosenFeature.id,
                type: buildingType,
                level: Buildings.getBuildingTier(buildingType),
                name,
                location,
                defense: buildingDef.defense || 150,
                religion: properties.religion || null,
                beds,
                storage: buildingDef.storageCapacity || 0,
                jobSlots: buildingDef.jobSlots || 0,
                sourceTags: tags,
                claimedAt: Date.now(),
                ownerId: player.name,
                isVirtual: false,
            });

            if (MapManager && MapManager.buildingLayer) {
                MapManager.loadBuildings();
            }
            if (OSMManager && OSMManager.osmLayer) {
                OSMManager.osmLayer.changed();
            }

            console.log(`AI Claim: Claim result:`, !!building);
            return { claimed: !!building, reason: !!building ? 'claimed' : 'claim_failed' };
        }

        const building = Buildings.claimBuilding(chosenFeature.id, buildingType, name, properties);
        console.log(`AI Claim: Claim result:`, building !== false);
        return { claimed: building !== false, reason: building !== false ? 'claimed' : 'claim_failed' };
    },
    
    aiChangeJob: (citizenIndex, citizens, buildings, player, foodCritical = false, foodLow = false, happinessLow = false) => {
        // buildings parameter should already be filtered to player buildings
        // Find available jobs and categorize them
        const availableJobs = [];
        const foodProducingJobs = [];
        const entertainmentJobs = [];
        
        // Count total job slots by job type across all buildings
        const jobSlotsByType = {};
        
        console.log(`AI Job: Citizen ${citizenIndex}, ${buildings.length} buildings available`);
        
        buildings.forEach(building => {
            const buildingDef = CONFIG.BUILDINGS[building.type];
            if (buildingDef.jobSlots) {
                // Find jobs compatible with this building
                Object.entries(CONFIG.JOBS).forEach(([jobKey, jobDef]) => {
                    if (jobDef.building === building.type.toLowerCase()) {
                        const jobId = jobKey.toLowerCase();
                        jobSlotsByType[jobId] = (jobSlotsByType[jobId] || 0) + (building.jobSlots || buildingDef.jobSlots);
                    }
                });
            }
        });
        
        console.log('AI Job: Job slots by type:', jobSlotsByType);
        
        // Check which jobs have available slots
        Object.entries(jobSlotsByType).forEach(([jobId, totalSlots]) => {
            const currentWorkers = citizens.filter(c => c.job === jobId).length;
            if (currentWorkers < totalSlots) {
                const jobDef = CONFIG.JOBS[jobId.toUpperCase()];
                const jobOption = { job: jobId, jobDef: jobDef };
                availableJobs.push(jobOption);
                
                // Track food-producing jobs
                if (jobDef.foodProduction) {
                    foodProducingJobs.push(jobOption);
                }
                
                // Track entertainment jobs
                if (jobDef.happinessProduction) {
                    entertainmentJobs.push(jobOption);
                }
            }
        });

        // Scavenging requires no building, so keep it available as a flexible option
        const scavengingDef = CONFIG.JOBS.SCAVENGING;
        if (scavengingDef) {
            availableJobs.push({ job: 'scavenging', jobDef: scavengingDef });
        }
        
        // Also allow quitting to idle
        availableJobs.push({ job: null });
        
        console.log(`AI Job: ${availableJobs.length - 1} jobs available, ${foodProducingJobs.length} food jobs, ${entertainmentJobs.length} entertainment jobs`);
        
        if (availableJobs.length === 0) return;
        
        let selected = null;
        
        // Check if we have enough seed production
        const currentGatherers = citizens.filter(c => c.job === 'gathering').length;
        const seedsAreCritical = (player.seeds || 0) < citizens.length * 2; // Seeds critical
        
        // Smart job selection based on situation
        if (seedsAreCritical && entertainmentJobs.length > 0) {
            // Seeds critical: switch to entertainment instead of farming to preserve seeds
            selected = entertainmentJobs[Math.floor(Math.random() * entertainmentJobs.length)];
        } else if (foodCritical && foodProducingJobs.length > 0) {
            // Critical: prioritize food production - but prefer gathering if seeds allow it
            const gatheringJobs = foodProducingJobs.filter(j => j.job === 'gathering');
            if (gatheringJobs.length > 0 && currentGatherers < Math.ceil(citizens.length / 8)) {
                selected = gatheringJobs[0]; // Prioritize gathering when food critical
            } else {
                selected = foodProducingJobs[Math.floor(Math.random() * foodProducingJobs.length)];
            }
        } else if (foodLow && foodProducingJobs.length > 0) {
            // Low food: favor gathering (produces seeds) over farming to maintain sustainability
            const gatheringJobs = foodProducingJobs.filter(j => j.job === 'gathering');
            if (gatheringJobs.length > 0 && currentGatherers < Math.ceil(citizens.length / 6)) {
                selected = gatheringJobs[0];
            } else {
                selected = Math.random() < 0.5 
                    ? foodProducingJobs[Math.floor(Math.random() * foodProducingJobs.length)]
                    : availableJobs[Math.floor(Math.random() * availableJobs.length)];
            }
        } else if (happinessLow && entertainmentJobs.length > 0 && !foodCritical && !foodLow) {
            // Low happiness but food is fine: pick entertainment job
            selected = entertainmentJobs[Math.floor(Math.random() * entertainmentJobs.length)];
        } else {
            const resourcesAreHigh =
                !foodCritical &&
                !foodLow &&
                !happinessLow &&
                (player.food || 0) > citizens.length * 10 &&
                (player.seeds || 0) > citizens.length * 6 &&
                (player.happiness || 50) >= 70;
            const scavengingOption = availableJobs.find(j => j.job === 'scavenging');

            if (resourcesAreHigh && scavengingOption && Math.random() < 0.35) {
                selected = scavengingOption;
            }

            // Normal: random job selection
            if (!selected) {
                selected = availableJobs[Math.floor(Math.random() * availableJobs.length)];
            }
        }
        
        // Only change if different from current job
        const citizen = citizens[citizenIndex];
        const oldJob = citizen.job;
        if (citizen && citizen.job !== selected.job) {
            console.log(`AI Job: Assigning citizen ${citizenIndex} from ${oldJob || 'idle'} to ${selected.job || 'idle'}`);
            const selectedJobDef = selected.job ? CONFIG.JOBS[selected.job.toUpperCase()] : null;
            const requiresBuilding = selectedJobDef && selectedJobDef.building;
            // Update in place
            citizen.job = selected.job;
            Storage.updateCitizen(citizen.id, {
                job: citizen.job,
                buildingId: requiresBuilding ? (citizen.buildingId || null) : null,
            });
            console.log(`AI Job: Updated citizen at index ${citizenIndex}`);
        } else {
            console.log(`AI Job: Citizen ${citizenIndex} already has ${selected.job || 'idle'}`);
        }
    },
    
    addXP: (amount) => {
        const player = Storage.getPlayer();
        player.xp = (player.xp || 0) + amount;
        
        // Check for level up
        const nextLevelXP = player.level * CONFIG.xpPerLevel;
        while (player.xp >= nextLevelXP) {
            player.xp -= nextLevelXP;
            player.level += 1;
            Game.addLog(`Level Up! You are now level ${player.level}`, 'success');
        }
        
        Storage.setPlayer(player);
        Resources.updateUI();
    },
    
    updateUI: () => {
        const player = Storage.getPlayer();
        if (!player) return;
        
        document.getElementById('player-level').textContent = player.level || 1;
        
        const nextLevelXP = (player.level || 1) * CONFIG.xpPerLevel;
        const currentXP = player.xp || 0;
        document.getElementById('xp').textContent = `${currentXP} / ${nextLevelXP}`;
        
        // Update time display
        const gameDay = Math.floor((player.gameTime || 0) / CONFIG.TIME.secondsPerDay) + 1;
        document.getElementById('game-day').textContent = gameDay;
        
        // Update happiness display
        const happinessPercent = Math.floor(player.happiness || 50);
        const happinessEl = document.getElementById('happiness');
        happinessEl.textContent = `${happinessPercent}%`;
        // Color code happiness
        if (happinessPercent >= 70) {
            happinessEl.style.color = '#4ade80'; // Green
        } else if (happinessPercent >= 40) {
            happinessEl.style.color = '#facc15'; // Yellow
        } else {
            happinessEl.style.color = '#f87171'; // Red
        }
        
        // Update citizen and resource counters
        const citizens = Storage.getCitizens();
        document.getElementById('citizens-count').textContent = citizens.length;
        document.getElementById('food-count').textContent = Math.floor(player.food || 0);
        document.getElementById('seeds-count').textContent = Math.floor(player.seeds || 0);
        document.getElementById('scrap-count').textContent = Math.floor(player.scrap || 0);
        const toolsEl = document.getElementById('tools-count');
        if (toolsEl) {
            toolsEl.textContent = Math.floor(player.tools || 0);
        }
        const soldiersEl = document.getElementById('soldiers-count');
        if (soldiersEl) {
            soldiersEl.textContent = Math.floor(player.soldiers || 0);
        }
        const religiousnessEl = document.getElementById('religiousness-count');
        if (religiousnessEl) {
            religiousnessEl.textContent = Math.floor(player.religiousness || 0);
        }
        
        // Update storage and beds info
        const totalBedsNeeded = citizens.length;
        const totalBedsAvailable = Buildings.getTotalBeds();
        const totalStorageNeeded = 
            (player.food * CONFIG.RESOURCES.storagePerFood) +
            (player.seeds * CONFIG.RESOURCES.storagePerSeed) +
            (player.scrap * CONFIG.RESOURCES.storagePerScrap) +
            ((player.tools || 0) * CONFIG.RESOURCES.storagePerTools) +
            ((player.soldiers || 0) * CONFIG.RESOURCES.storagePerSoldier);
        const totalStorageAvailable = Buildings.getTotalStorage();
        
        document.getElementById('beds-info').textContent = `${totalBedsNeeded}/${totalBedsAvailable}`;
        document.getElementById('storage-info').textContent = 
            `${Math.floor(totalStorageNeeded)}/${totalStorageAvailable}`;
    },

    craftSoldier: (armoryId) => {
        const armory = Storage.getBuildings().find(b => b.id === armoryId);
        if (!armory || armory.type !== 'ARMORY' || (armory.ownerId && armory.ownerId !== 'player')) {
            Game.addLog('Soldiers can only be crafted in your Armory.', 'error');
            return false;
        }

        const player = Storage.getPlayer();
        const citizens = Storage.getCitizens();
        const citizenCost = 1;
        const toolsCost = 5;

        if ((player.tools || 0) < toolsCost) {
            Game.addLog(`Not enough tools! Need ${toolsCost}.`, 'error');
            return false;
        }

        const adultIdleIndex = citizens.findIndex(c => c.ageGroup === 'adult' && !c.job);
        const adultAnyIndex = citizens.findIndex(c => c.ageGroup === 'adult');
        const citizenIndex = adultIdleIndex !== -1 ? adultIdleIndex : adultAnyIndex;

        if (citizenIndex === -1) {
            Game.addLog('No adult citizens available to train as soldiers.', 'error');
            return false;
        }

        const totalStorage = Buildings.getTotalStorage();
        const currentStorageUsage =
            ((player.food || 0) * CONFIG.RESOURCES.storagePerFood) +
            ((player.seeds || 0) * CONFIG.RESOURCES.storagePerSeed) +
            ((player.scrap || 0) * CONFIG.RESOURCES.storagePerScrap) +
            ((player.tools || 0) * CONFIG.RESOURCES.storagePerTools) +
            ((player.soldiers || 0) * CONFIG.RESOURCES.storagePerSoldier);
        const resultingStorageUsage =
            currentStorageUsage -
            (toolsCost * CONFIG.RESOURCES.storagePerTools) +
            CONFIG.RESOURCES.storagePerSoldier;

        if (resultingStorageUsage > totalStorage) {
            Game.addLog('Not enough storage capacity to train another soldier.', 'error');
            return false;
        }

        citizens.splice(citizenIndex, citizenCost);
        Storage.setCitizens(citizens);

        player.tools = Math.max(0, (player.tools || 0) - toolsCost);
        player.soldiers = Math.max(0, (player.soldiers || 0) + 1);
        Storage.setPlayer(player);

        Game.addLog('A soldier has been trained at the Armory.', 'success');
        Resources.updateUI();
        return true;
    },

    attackEnemyBuilding: (buildingId) => {
        const target = Storage.getBuildings().find(b => b.id === buildingId);
        if (!target || !target.ownerId || target.ownerId === 'player') {
            Game.addLog('You can only attack enemy-claimed buildings.', 'error');
            return false;
        }

        const player = Storage.getPlayer();
        const soldiers = Math.floor(player.soldiers || 0);
        if (soldiers < 1) {
            Game.addLog('No soldiers available. Train soldiers at an Armory first.', 'warning');
            return false;
        }

        player.soldiers = soldiers - 1;
        Storage.setPlayer(player);

        const citizens = Storage.getCitizens();
        const activeGunsmiths = citizens.filter(citizen => citizen.job === 'gunsmith').length;
        const baseSoldierDamage = CONFIG.COMBAT?.baseSoldierDamage || 100;
        const gunsmithBonusPerWorker = CONFIG.COMBAT?.gunsmithBonusPerWorker || 0;
        const maxGunsmithBonus = CONFIG.COMBAT?.maxGunsmithBonus || 0;
        const damageMultiplier = 1 + Math.min(maxGunsmithBonus, activeGunsmiths * gunsmithBonusPerWorker);
        const soldierDamage = Math.max(1, Math.round(baseSoldierDamage * damageMultiplier));

        const updatedDefense = Math.max(0, (target.defense || 0) - soldierDamage);
        if (updatedDefense <= 0) {
            const defeatedOwnerId = target.ownerId;
            let buildings = Storage.getBuildings();

            if (target.type === 'HQ') {
                const removedCount = buildings.filter(b => b.ownerId === defeatedOwnerId).length;
                buildings = buildings.filter(b => b.ownerId !== defeatedOwnerId);
                Storage.setBuildings(buildings);
                Game.addLog(`Enemy HQ "${target.name}" has fallen. ${removedCount} building${removedCount === 1 ? '' : 's'} became unclaimed.`, 'success');
            } else {
                buildings = buildings.filter(b => b.id !== target.id);
                Storage.setBuildings(buildings);
                Game.addLog(`Enemy building "${target.name}" was defeated and became unclaimed.`, 'success');
            }

            Resources.addXP(CONFIG.xpPerBase);
        } else {
            Storage.updateBuilding(target.id, { defense: updatedDefense });
            Game.addLog(`Soldier attack hit ${target.name} for ${soldierDamage} defense damage.`, 'success');
        }

        if (MapManager && MapManager.buildingLayer) {
            MapManager.loadBuildings();
        }
        if (OSMManager && OSMManager.osmLayer) {
            OSMManager.osmLayer.changed();
        }

        Resources.updateUI();
        return true;
    },
    
    updateAIPlayers: () => {
        const aiPlayers = Storage.getAIPlayers();
        if (!aiPlayers || aiPlayers.length === 0) return;
        
        console.log(`🤖 AI Update: Simulating ${aiPlayers.length} AI players`);
        
        aiPlayers.forEach((aiPlayer, idx) => {
            Resources.simulateAIExpansion(aiPlayer, idx);
        });
        
        // Save updated AI players
        Storage.setAIPlayers(aiPlayers);
    },
    
    simulateAIExpansion: (aiPlayer, aiIndex) => {
        // Get AI's buildings
        const allBuildings = Storage.getBuildings();
        const aiBuildings = allBuildings.filter(b => b.ownerId === aiPlayer.name);
        
        console.log(`🤖 ${aiPlayer.name}: ${aiBuildings.length} buildings`);
        
        // Check if AI has HQ
        const hasHQ = aiBuildings.some(b => b.type === 'HQ');
        
        // If no HQ, create one at a starting position
        if (!hasHQ) {
            Resources.createAIStartingHQ(aiPlayer, aiIndex);
            return;
        }

        // Ensure a limited local OSM pool exists around this AI HQ
        Resources.ensureAIOsmFeatures(aiPlayer, aiBuildings);
        
        // Simulate growth based on free control settings
        const controlSettings = CONFIG.GOVERNMENT.controlLevels.free;
        const expansionChance = controlSettings.claimChance || 0.15;

        const estimatedCitizens = Math.max(
            8,
            aiBuildings.reduce((sum, building) => sum + (building.beds || 0), 0)
        );
        const simulatedCitizens = Array.from({ length: estimatedCitizens }, (_, idx) => ({
            id: `ai_citizen_${aiPlayer.name}_${idx}`,
        }));

        const foodCritical = (aiPlayer.food || 0) < estimatedCitizens * 5;
        const foodLow = (aiPlayer.food || 0) < estimatedCitizens * 30;
        
        // AI has a chance to claim a new building
        if (Math.random() < expansionChance) {
            Resources.aiClaimBuilding(aiPlayer, simulatedCitizens, aiBuildings, foodCritical, foodLow, expansionChance);
        }
    },

    ensureAIOsmFeatures: (aiPlayer, aiBuildings = []) => {
        if (!aiPlayer || !aiPlayer.name) return [];

        if (!Array.isArray(aiPlayer.generatedOsmFeatures)) {
            aiPlayer.generatedOsmFeatures = [];
        }

        const claimedIds = new Set(Storage.getBuildings().map((building) => String(building.osmId)));
        aiPlayer.generatedOsmFeatures = aiPlayer.generatedOsmFeatures.filter((feature) =>
            feature && feature.id !== undefined && feature.id !== null && !claimedIds.has(String(feature.id))
        );

        const now = Date.now();
        const refreshMs = 120000; // 2 minutes
        const hasBuildings = Array.isArray(aiBuildings) && aiBuildings.length > 0;
        const needsRefresh =
            hasBuildings &&
            (!aiPlayer.lastAIOsmFetchAt || (now - aiPlayer.lastAIOsmFetchAt) > refreshMs || aiPlayer.generatedOsmFeatures.length === 0);

        if (needsRefresh && !aiPlayer.aiOsmFetchInFlight) {
            aiPlayer.aiOsmFetchInFlight = true;
            Resources.fetchAIOsmFeatures(aiPlayer, aiBuildings)
                .then((fetchedFeatures) => {
                    if (Array.isArray(fetchedFeatures)) {
                        const latestClaimedIds = new Set(Storage.getBuildings().map((building) => String(building.osmId)));
                        const unclaimedFetched = fetchedFeatures.filter((feature) => !latestClaimedIds.has(String(feature.id)));
                        aiPlayer.generatedOsmFeatures = unclaimedFetched;
                        aiPlayer.lastAIOsmFetchAt = Date.now();

                        const storedAIPlayers = Storage.getAIPlayers();
                        const aiIndex = storedAIPlayers.findIndex((ai) => ai && ai.name === aiPlayer.name);
                        if (aiIndex !== -1) {
                            storedAIPlayers[aiIndex] = {
                                ...storedAIPlayers[aiIndex],
                                generatedOsmFeatures: aiPlayer.generatedOsmFeatures,
                                lastAIOsmFetchAt: aiPlayer.lastAIOsmFetchAt,
                                aiOsmFetchInFlight: true,
                            };
                            Storage.setAIPlayers(storedAIPlayers);
                        }
                    }
                })
                .catch((error) => {
                    console.error(`AI OSM fetch failed for ${aiPlayer.name}:`, error);
                })
                .finally(() => {
                    aiPlayer.aiOsmFetchInFlight = false;

                    const storedAIPlayers = Storage.getAIPlayers();
                    const aiIndex = storedAIPlayers.findIndex((ai) => ai && ai.name === aiPlayer.name);
                    if (aiIndex !== -1) {
                        storedAIPlayers[aiIndex] = {
                            ...storedAIPlayers[aiIndex],
                            generatedOsmFeatures: aiPlayer.generatedOsmFeatures || [],
                            lastAIOsmFetchAt: aiPlayer.lastAIOsmFetchAt || null,
                            aiOsmFetchInFlight: false,
                        };
                        Storage.setAIPlayers(storedAIPlayers);
                    }
                });
        }

        return aiPlayer.generatedOsmFeatures;
    },

    fetchAIOsmFeatures: async (aiPlayer, aiBuildings = []) => {
        if (!Array.isArray(aiBuildings) || aiBuildings.length === 0) {
            return [];
        }

        const validLocations = aiBuildings
            .map((building) => building && Array.isArray(building.location) ? building.location : null)
            .filter((location) => Array.isArray(location) && location.length >= 2 && Number.isFinite(location[0]) && Number.isFinite(location[1]));

        if (validLocations.length === 0) {
            return [];
        }

        const radiusMeters = 200;
        const aroundClauses = validLocations.slice(0, 40).map((location) => {
            const lon = location[0];
            const lat = location[1];
            return `
                node["building"](around:${radiusMeters},${lat},${lon});
                way["building"](around:${radiusMeters},${lat},${lon});
                node["amenity"](around:${radiusMeters},${lat},${lon});
                way["amenity"](around:${radiusMeters},${lat},${lon});
                way["landuse"~"farm|farmland|meadow|forest|residential"](around:${radiusMeters},${lat},${lon});
                node["shop"](around:${radiusMeters},${lat},${lon});
                way["shop"](around:${radiusMeters},${lat},${lon});
            `;
        }).join('\n');

        const query = `
            [out:json][timeout:25];
            (
                ${aroundClauses}
            );
            out body center geom tags;
        `;

        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Overpass request failed (${response.status})`);
        }

        const data = await response.json();
        const elements = Array.isArray(data && data.elements) ? data.elements : [];
        const claimedIds = new Set(Storage.getBuildings().map((building) => String(building.osmId)));
        const uniqueById = new Map();

        elements.forEach((element) => {
            if (!element || element.id === undefined || element.id === null) return;

            const normalizedFeature = {
                id: element.id,
                type: element.type,
                tags: element.tags || {},
                geometry: element,
            };

            const normalizedId = String(normalizedFeature.id);
            if (claimedIds.has(normalizedId)) return;
            if (!uniqueById.has(normalizedId)) {
                uniqueById.set(normalizedId, normalizedFeature);
            }
        });

        return Array.from(uniqueById.values());
    },

    generateAIOsmFeature: (aiPlayer, aiBuildings = [], indexSeed = 0) => {
        const hqBuilding = aiBuildings.find((building) => building.type === 'HQ');
        const origin = (hqBuilding && Array.isArray(hqBuilding.location))
            ? hqBuilding.location
            : (Array.isArray(CONFIG.mapCenter) ? CONFIG.mapCenter : [0, 0]);

        const templates = [
            { tags: { building: 'residential' }, weight: 14 },
            { tags: { building: 'house' }, weight: 12 },
            { tags: { building: 'apartments' }, weight: 5 },
            { tags: { landuse: 'farm' }, weight: 9 },
            { tags: { landuse: 'farmland' }, weight: 9 },
            { tags: { natural: 'forest' }, weight: 7 },
            { tags: { natural: 'wood' }, weight: 7 },
            { tags: { building: 'warehouse' }, weight: 7 },
            { tags: { building: 'workshop' }, weight: 6 },
            { tags: { industrial: 'workshop' }, weight: 3 },
            { tags: { amenity: 'clinic' }, weight: 4 },
            { tags: { amenity: 'place_of_worship' }, weight: 4 },
            { tags: { man_made: 'water_tower' }, weight: 4 },
            { tags: { building: 'mill' }, weight: 3 },
            { tags: { landuse: 'orchard' }, weight: 3 },
            { tags: { building: 'greenhouse' }, weight: 2 },
            { tags: { building: 'hydroponics' }, weight: 1 },
            { tags: { building: 'silo' }, weight: 2 },
            { tags: { shop: 'garden_centre' }, weight: 2 },
            { tags: { landuse: 'allotments' }, weight: 2 },
            { tags: { amenity: 'marketplace' }, weight: 2 },
            { tags: { amenity: 'farmers_market' }, weight: 1 },
            { tags: { leisure: 'community_garden' }, weight: 1 },
            { tags: { building: 'plant_nursery' }, weight: 1 },
            { tags: { building: 'yes' }, weight: 1 },
        ];

        const totalWeight = templates.reduce((sum, template) => sum + template.weight, 0);
        let roll = Math.random() * totalWeight;
        let selectedTemplate = templates[0];
        for (const template of templates) {
            roll -= template.weight;
            if (roll <= 0) {
                selectedTemplate = template;
                break;
            }
        }

        const angle = Math.random() * Math.PI * 2;
        const radius = 0.02 + (Math.random() * 0.18);
        const location = [
            origin[0] + (Math.cos(angle) * radius),
            origin[1] + (Math.sin(angle) * radius),
        ];

        const featureId = `ai_osm_${aiPlayer.name}_${Date.now()}_${indexSeed}_${Math.random().toString(36).slice(2, 8)}`;
        const tags = {
            ...selectedTemplate.tags,
            name: `${aiPlayer.name} Site ${Math.floor(Math.random() * 900) + 100}`,
        };

        return {
            id: featureId,
            type: 'node',
            tags,
            geometry: {
                lon: location[0],
                lat: location[1],
            },
        };
    },
    
    createAIStartingHQ: (aiPlayer, aiIndex) => {
        console.log(`🏛️ Creating starting HQ for ${aiPlayer.name}`);
        
        // Generate starting position spread around the map
        // Use aiIndex to position AI players in different areas
        const baseLocations = [
            [-118.2437, 34.0522],  // Los Angeles
            [-87.6298, 41.8781],   // Chicago
            [-95.3698, 29.7604],   // Houston
            [-122.4194, 37.7749],  // San Francisco
            [-80.1918, 25.7617],   // Miami
        ];
        
        const location = baseLocations[aiIndex] || [
            -120 + Math.random() * 60,  // Random longitude (USA range)
            30 + Math.random() * 15      // Random latitude (USA range)
        ];

        if (!Array.isArray(aiPlayer.generatedOsmFeatures)) {
            aiPlayer.generatedOsmFeatures = [];
        }

        const hqFeatureId = `ai_osm_hq_${aiPlayer.name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        aiPlayer.generatedOsmFeatures.push({
            id: hqFeatureId,
            type: 'node',
            tags: {
                building: 'residential',
                name: `${aiPlayer.name} Founding Block`,
            },
            geometry: {
                lon: location[0],
                lat: location[1],
            },
        });
        
        // Create HQ building for AI
        const hqBuilding = {
            osmId: hqFeatureId,
            type: 'HQ',
            level: 1,
            name: `${aiPlayer.name} Headquarters`,
            location: location,
            beds: 15,
            storage: 500,
            jobSlots: 2,
            claimedAt: Date.now(),
            ownerId: aiPlayer.name,
            isVirtual: false,
        };
        
        Storage.addBuilding(hqBuilding);
        
        // Show notification using player's color for the AI
        const colorStyle = `color: ${aiPlayer.civilizationColor}; font-weight: bold;`;
        Game.addLog(`<span style="${colorStyle}">${aiPlayer.name}</span> has established their headquarters!`, 'info');
        
        // Force map redraw
        if (MapManager && MapManager.buildingLayer) {
            MapManager.loadBuildings();
        }
    },
    
};

window.Resources = Resources;

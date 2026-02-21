// Main game logic
const Game = {
    selectedLocation: null,
    selectedBase: null,
    selectedBuilding: null,
    
    init: () => {
        console.log('🎮 Game.init() CALLED');
        // Initialize storage
        Storage.init();
        
        // Set up event listeners first
        Game.setupInitialEventListeners();
        
        // Check for existing game
        const savedGame = Storage.getPlayer();
        
        if (savedGame) {
            // Resume game
            Game.startGame();
        } else {
            // Show setup modal
            Game.showSetup();
        }
    },
    
    showSetup: () => {
        const modal = document.getElementById('modal-setup');
        modal.style.display = 'flex';
        document.getElementById('player-name').focus();
    },
    
    setupInitialEventListeners: () => {
        console.log('🎮 setupInitialEventListeners called');
        // Setup modal listeners
        document.getElementById('btn-start-game').addEventListener('click', () => {
            const civilizationName = document.getElementById('civilization-name').value || 'New Civilization';
            const civilizationColor = document.getElementById('civilization-color').value || '#22c55e';
            const aiPlayerCount = parseInt(document.getElementById('ai-players').value) || 0;
            Game.newGame(civilizationName, civilizationColor, aiPlayerCount);
        });
        
        document.getElementById('btn-close-setup').addEventListener('click', () => {
            document.getElementById('civilization-name').value = '';
            document.getElementById('civilization-color').value = '#22c55e';
            document.getElementById('ai-players').value = '0';
            document.getElementById('civilization-name').focus();
        });
        
        // Allow Enter key to start game
        document.getElementById('civilization-name').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const civilizationName = document.getElementById('civilization-name').value || 'New Civilization';
                const civilizationColor = document.getElementById('civilization-color').value || '#22c55e';
                const aiPlayerCount = parseInt(document.getElementById('ai-players').value) || 0;
                Game.newGame(civilizationName, civilizationColor, aiPlayerCount);
            }
        });
        
        // Color preset buttons
        document.querySelectorAll('.color-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const color = btn.getAttribute('data-color');
                document.getElementById('civilization-color').value = color;
            });
        });
        
        // Modal close buttons
        document.getElementById('btn-close-citizens').addEventListener('click', () => {
            document.getElementById('citizens-modal').style.display = 'none';
        });
        
        document.getElementById('btn-close-buildings').addEventListener('click', () => {
            document.getElementById('buildings-modal').style.display = 'none';
        });
        
        document.getElementById('btn-close-claim').addEventListener('click', () => {
            document.getElementById('claim-building-modal').style.display = 'none';
        });
        
        document.getElementById('btn-close-citizen').addEventListener('click', () => {
            document.getElementById('citizen-modal').style.display = 'none';
        });
        
        document.getElementById('btn-close-government').addEventListener('click', () => {
            document.getElementById('government-modal').style.display = 'none';
        });
        
        document.getElementById('btn-close-demographics').addEventListener('click', () => {
            document.getElementById('demographics-modal').style.display = 'none';
        });
    },
    
    newGame: (civilizationName, civilizationColor, aiPlayerCount = 0) => {
        // Clear storage
        Storage.clearGame();
        
        // Create new player
        const player = {
            name: civilizationName,
            civilizationName: civilizationName,
            civilizationColor: civilizationColor,
            level: 1,
            xp: 0,
            citizens: 0, // No citizens until HQ is built
            food: CONFIG.initialFood,
            seeds: CONFIG.initialSeeds,
            scrap: CONFIG.initialScrap,
            tools: 0,
            soldiers: 0,
            happiness: CONFIG.initialHappiness,
            gameTime: 0, // Time in seconds since game start
            lastArrivalCheck: 0,
            lastJobChangeCheck: 0,
            starvationTimer: 0, // Track consecutive time with no food
            createdAt: Date.now(),
            // Government settings
            controlLevel: CONFIG.GOVERNMENT.defaultControl,
            religionLevel: CONFIG.GOVERNMENT.defaultReligion,
            stateReligion: null,
            religiousness: CONFIG.GOVERNMENT.defaultReligion === 'strict' ? 20 : 0,
            isAI: false,
        };
        
        Storage.setPlayer(player);
        
        // Create AI players
        if (aiPlayerCount > 0) {
            Game.createAIPlayers(aiPlayerCount);
        }
        
        // Don't add initial citizens - they arrive naturally after HQ is built
        
        // Hide modal
        const modal = document.getElementById('modal-setup');
        modal.style.display = 'none';
        
        // Start game
        Game.startGame();
        const aiMessage = aiPlayerCount > 0 ? ` ${aiPlayerCount} AI civilization${aiPlayerCount > 1 ? 's' : ''} will compete with you!` : '';
        Game.addLog(`Welcome to ${civilizationName}! Build a Headquarters to start recruiting citizens.${aiMessage}`, 'success');
    },
    
    createAIPlayers: (count) => {
        const religionLevels = ['strict', 'moderate', 'tolerant', 'none'];
        const aiPlayers = [];
        
        for (let i = 0; i < Math.min(count, CONFIG.AI_CIVILIZATIONS.length); i++) {
            const aiConfig = CONFIG.AI_CIVILIZATIONS[i];
            const randomReligion = religionLevels[Math.floor(Math.random() * religionLevels.length)];
            const stateReligion = randomReligion === 'strict'
                ? CONFIG.DEMOGRAPHICS.religions[Math.floor(Math.random() * CONFIG.DEMOGRAPHICS.religions.length)]
                : null;
            
            const aiPlayer = {
                name: aiConfig.name,
                civilizationName: aiConfig.name,
                civilizationColor: aiConfig.color,
                level: 1,
                xp: 0,
                citizens: 0,
                food: CONFIG.initialFood,
                seeds: CONFIG.initialSeeds,
                scrap: CONFIG.initialScrap,
                tools: 0,
                soldiers: 0,
                happiness: CONFIG.initialHappiness,
                gameTime: 0,
                lastArrivalCheck: 0,
                lastJobChangeCheck: 0,
                starvationTimer: 0,
                createdAt: Date.now(),
                controlLevel: 'free', // AI always has free control
                religionLevel: randomReligion,
                stateReligion: stateReligion,
                religiousness: randomReligion === 'strict' ? 20 : 0,
                isAI: true,
            };
            
            aiPlayers.push(aiPlayer);
        }
        
        Storage.setAIPlayers(aiPlayers);
        console.log(`Created ${aiPlayers.length} AI players:`, aiPlayers.map(p => p.name));
    },
    
    startGame: () => {
        // Initialize all systems
        MapManager.init();
        Resources.init();
        Game.setupEventListeners();
        Resources.updateUI();
    },
    
    setupEventListeners: () => {
        console.log('setupEventListeners called');
        // Control buttons
        document.getElementById('btn-buildings').addEventListener('click', Game.showBuildingsModal);
        document.getElementById('btn-citizens').addEventListener('click', Game.showCitizensModal);
        document.getElementById('btn-demographics').addEventListener('click', Game.showDemographicsModal);
        document.getElementById('btn-government').addEventListener('click', Game.showGovernmentModal);
        document.getElementById('btn-locate').addEventListener('click', MapManager.locatePlayer);

        document.querySelectorAll('.panel-minimize').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = btn.dataset.target;
                const panel = document.getElementById(targetId);
                if (!panel) return;
                const minimized = panel.classList.toggle('minimized');
                btn.textContent = minimized ? '+' : '−';
            });
        });
        
        const zoomInBtn = document.getElementById('btn-zoom-in');
        const zoomOutBtn = document.getElementById('btn-zoom-out');
        console.log('Zoom buttons found:', !!zoomInBtn, !!zoomOutBtn);
        
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => {
                console.log('Zoom in clicked!', MapManager, MapManager.map);
                MapManager.zoomIn();
            });
        }
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => {
                console.log('Zoom out clicked!', MapManager, MapManager.map);
                MapManager.zoomOut();
            });
        }
        
        // Base info panel
        document.getElementById('btn-close-base').addEventListener('click', Game.closeBaseInfo);
        document.getElementById('btn-build-here').addEventListener('click', () => {
            if (Game.selectedLocation && !Game.selectedLocation.id) {
                if (Base.buildBase(Game.selectedLocation)) {
                    Game.closeBaseInfo();
                }
            }
        });
        
        // Building info panel
        document.getElementById('btn-close-building').addEventListener('click', Game.closeBuildingInfo);
        
        // Buildings modal actions (no longer need claim button)
        
        // Note: Removed hire citizen button - citizens arrive naturally based on happiness
        console.log('All event listeners attached successfully');
    },
    
    selectLocation: (coords) => {
        Game.selectedLocation = {
            location: coords,
            id: null,
        };
        Game.selectedBase = null;
        
        Game.showBaseInfo(Game.selectedLocation);
    },
    
    selectBase: (base) => {
        Game.selectedLocation = null;
        Game.selectedBase = base;
        Game.showBaseInfo(base);
    },
    
    selectBuilding: (building) => {
        Game.selectedBuilding = building;
        Game.showBuildingInfo(building);
    },
    
    selectOSMFeature: (feature) => {
        const osmData = feature.get('osmData');
        if (!osmData) return;
        
        const tags = osmData.tags || {};
        const buildings = Storage.getBuildings();
        const isClaimed = buildings.some(b => b.osmId === osmData.id);
        
        if (isClaimed) {
            // Show the claimed building info
            const building = buildings.find(b => b.osmId === osmData.id);
            Game.selectBuilding(building);
        } else {
            // Show claim modal
            Game.showClaimOSMFeatureModal(osmData, feature);
        }
    },
    
    showBaseInfo: (data) => {
        const panel = document.getElementById('base-info');
        const details = document.getElementById('base-details');
        
        if (data.id) {
            // Existing base
            details.innerHTML = Base.getBaseInfo(data);
            document.getElementById('btn-build-here').textContent = 'Upgrade Base';
            document.getElementById('btn-build-here').onclick = () => {
                if (Base.upgradeBase(data.id)) {
                    Game.selectBase(Storage.getBases().find(b => b.id === data.id));
                }
            };
        } else {
            // Empty location
            const buildings = Storage.getBuildings();
            const hqExists = buildings.some(b => b.type === 'HQ');
            
            details.innerHTML = `
                <strong>Empty Location</strong><br>
                Lat: ${data.location[1].toFixed(4)}<br>
                Lon: ${data.location[0].toFixed(4)}<br>
                <br>
                <em>${hqExists ? 'Build something here to expand!' : 'Build a Headquarters first!'}</em>
            `;
            
            if (!hqExists) {
                // Can only build base
                document.getElementById('btn-build-here').textContent = 'Build Base';
                document.getElementById('btn-build-here').onclick = () => {
                    if (Base.buildBase(data.location)) {
                        Game.closeBaseInfo();
                    }
                };
                document.getElementById('btn-build-here').style.display = 'block';
            } else {
                // Can build both base and farm - hide btn-build-here, show instructions
                document.getElementById('btn-build-here').style.display = 'none';
                Game.addLog('Click on an empty area to build a base or farm.', 'info');
            }
        }
        
        panel.style.display = 'block';
    },
    
    closeBaseInfo: () => {
        document.getElementById('base-info').style.display = 'none';
        document.getElementById('btn-build-here').style.display = 'block';
        Game.selectedLocation = null;
        Game.selectedBase = null;
        MapManager.map.changed();
    },
    
    addLog: (message, type = 'info') => {
        const logContent = document.getElementById('log-content');
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        
        logContent.appendChild(entry);
        logContent.scrollTop = logContent.scrollHeight;
        
        // Keep only last 20 messages
        while (logContent.children.length > 20) {
            logContent.removeChild(logContent.firstChild);
        }
    },
    
    showBuildingInfo: (building) => {
        const panel = document.getElementById('building-info');
        const details = document.getElementById('building-details');
        const actions = document.getElementById('building-actions');
        const isOwnedByPlayer = !building.ownerId || building.ownerId === 'player';
        
        details.innerHTML = Buildings.getBuildingInfo(building);
        
        // Generate job assignment buttons for buildings with job slots
        let actionsHTML = '';
        if (isOwnedByPlayer && building.jobSlots && building.jobSlots > 0) {
            const jobCounts = Buildings.getJobSlotsCounts(building.id);
            actionsHTML += `<div style="margin: 12px 0; font-size: 12px; color: #a0a0a0;">`;
            actionsHTML += `Job Slots Available: ${jobCounts.available}/${building.jobSlots}</div>`;
            
            // Show job buttons if slots available
            if (jobCounts.available > 0) {
                const icons = {
                    'FARMING': '🌾',
                    'GATHERING': '🌲',
                    'SCAVENGING': '🔨',
                    'MILITARY': '⚔️',
                };
                
                Object.entries(CONFIG.JOBS).forEach(([key, jobDef]) => {
                    if (jobDef.building === building.type.toLowerCase() || !jobDef.building) {
                        let label = `Assign ${icons[key] || '•'}`;
                        if (key === 'PRIEST' && building.religion) {
                            label = `Assign ${Buildings.getReligionJobName(building.religion)}`;
                        }
                        actionsHTML += `<button class="btn btn-small assign-job" data-job="${key}" data-building="${building.id}">`;
                        actionsHTML += `${label}</button>`;
                    }
                });
            }
        }

        if (isOwnedByPlayer && building.type === 'ARMORY') {
            actionsHTML += `<button class="btn btn-small craft-soldier" data-building="${building.id}">Craft Soldier (1 Citizen + 5 Tools)</button>`;
        }

        if (!isOwnedByPlayer) {
            actionsHTML += `<button class="btn btn-small attack-enemy-building" data-building="${building.id}">Attack Building (Consumes 1 Soldier)</button>`;
        }

        if (isOwnedByPlayer) {
            const upgradeOptions = Buildings.getUpgradeOptions(building);
            if (upgradeOptions.length > 0) {
                upgradeOptions.forEach((option) => {
                    actionsHTML += `<button class="btn btn-small upgrade-building" data-building="${building.id}" data-target="${option.type}">`;
                    actionsHTML += `Upgrade to ${option.name} (Tier ${option.tier}: ${option.scrapCost} scrap, ${option.toolCost} tools)</button>`;
                });
            } else {
                // Check if no upgrades because it's a known house
                if (Buildings.isKnownHouse(building)) {
                    actionsHTML += `<div style="margin-top: 8px; font-size: 12px; color: #fbbf24;">⭐ This historic landmark cannot be upgraded</div>`;
                } else {
                    actionsHTML += `<div style="margin-top: 8px; font-size: 12px; color: #a0a0a0;">No upgrades available here</div>`;
                }
            }
        }
        
        actions.innerHTML = actionsHTML;
        
        // Attach event listeners
        actions.querySelectorAll('.assign-job').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const jobType = e.target.dataset.job;
                const buildingId = e.target.dataset.building;
                Game.showAssignJobModal(jobType, buildingId);
            });
        });
        
        actions.querySelectorAll('.upgrade-building').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const buildingId = e.target.dataset.building;
                const targetType = e.target.dataset.target;
                if (Buildings.upgradeBuilding(buildingId, targetType)) {
                    Game.selectBuilding(Storage.getBuildings().find(b => b.id === buildingId));
                }
            });
        });

        actions.querySelectorAll('.craft-soldier').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const buildingId = e.target.dataset.building;
                if (Resources.craftSoldier(buildingId)) {
                    const updatedBuilding = Storage.getBuildings().find(b => b.id === buildingId);
                    if (updatedBuilding) {
                        Game.selectBuilding(updatedBuilding);
                    }
                }
            });
        });

        actions.querySelectorAll('.attack-enemy-building').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const buildingId = e.target.dataset.building;
                const attacked = Resources.attackEnemyBuilding(buildingId);
                if (attacked) {
                    const updatedBuilding = Storage.getBuildings().find(b => b.id === buildingId);
                    if (updatedBuilding) {
                        Game.selectBuilding(updatedBuilding);
                    } else {
                        Game.closeBuildingInfo();
                    }
                }
            });
        });
        
        panel.style.display = 'block';
    },
    
    closeBuildingInfo: () => {
        document.getElementById('building-info').style.display = 'none';
        Game.selectedBuilding = null;
        MapManager.map.changed();
    },
    
    showAssignJobModal: (jobType, buildingId) => {
        const citizens = Storage.getCitizens();
        const unassignedCitizens = citizens.filter(c => !c.job || c.buildingId !== buildingId);
        
        if (unassignedCitizens.length === 0) {
            Game.addLog('No citizens available to assign!', 'warning');
            return;
        }
        
        const modal = document.getElementById('citizen-modal');
        const title = document.getElementById('citizen-modal-title');
        const details = document.getElementById('citizen-details');
        const actions = document.getElementById('citizen-actions');
        
        title.textContent = 'Assign Citizen to Job';
        details.innerHTML = '<div class="list-container">' +
            unassignedCitizens.map(c => `
                <div class="list-item">
                    <div class="list-item-header">${c.name}</div>
                    <button class="btn btn-small" onclick="Buildings.assignCitizenToJob('${c.id}', '${jobType}', '${buildingId}'); document.getElementById('citizen-modal').style.display='none'; Game.selectBuilding(Storage.getBuildings().find(b => b.id === '${buildingId}'));">
                        Assign
                    </button>
                </div>
            `).join('') +
            '</div>';
        
        actions.innerHTML = '';
        modal.style.display = 'flex';
    },
    
    showCitizensModal: () => {
        const citizens = Storage.getCitizens();
        const stats = Citizens.getCitizenStats();
        const modal = document.getElementById('citizens-modal');
        const list = document.getElementById('citizens-list');
        
        // Calculate demographics
        const adults = citizens.filter(c => c.ageGroup === 'adult').length;
        const children = citizens.filter(c => c.ageGroup === 'child').length;
        const elders = citizens.filter(c => c.ageGroup === 'elder').length;
        
        // Count by gender
        const males = citizens.filter(c => c.gender === 'Male').length;
        const females = citizens.filter(c => c.gender === 'Female').length;
        const nonbinary = citizens.filter(c => c.gender === 'Non-binary').length;
        
        // Count by ethnicity
        const ethnicityCounts = {};
        citizens.forEach(c => {
            ethnicityCounts[c.ethnicity] = (ethnicityCounts[c.ethnicity] || 0) + 1;
        });

        // Count by job dynamically from CONFIG.JOBS
        const jobCounts = {};
        citizens.forEach((citizen) => {
            if (!citizen.job) return;
            jobCounts[citizen.job] = (jobCounts[citizen.job] || 0) + 1;
        });

        const employmentLines = Object.entries(CONFIG.JOBS)
            .map(([jobKey, jobDef]) => {
                const jobId = jobKey.toLowerCase();
                const count = jobCounts[jobId] || 0;
                return `- ${jobDef.name}s: ${count}`;
            })
            .join('<br>');
        
        const listHTML = `
            <div style="margin-bottom: 16px; color: #b0b0b0; line-height: 1.6;">
                <strong style="color: #4a9fd8;">Total Population: ${stats.total}</strong><br><br>
                
                <strong style="color: #4a9fd8;">Age Distribution:</strong><br>
                Adults (18-64): ${adults}<br>
                Children (0-17): ${children}<br>
                Elders (65+): ${elders}<br><br>
                
                <strong style="color: #4a9fd8;">Gender Distribution:</strong><br>
                Male: ${males}<br>
                Female: ${females}<br>
                Non-binary: ${nonbinary}<br><br>
                
                <strong style="color: #4a9fd8;">Ethnicity Distribution:</strong><br>
                ${Object.entries(ethnicityCounts).map(([eth, count]) => `${eth}: ${count}`).join('<br>')}<br><br>
                
                <strong style="color: #4a9fd8;">Employment:</strong><br>
                Working: ${stats.total - stats.idle}<br>
                Idle: ${stats.idle}<br>
                ${employmentLines}<br>
            </div>
        `;
        
        list.innerHTML = listHTML;
        modal.style.display = 'flex';
    },
    
    showCitizenDetailsModal: (citizenId) => {
        const citizen = Storage.getCitizens().find(c => c.id === citizenId);
        if (!citizen) return;
        
        const modal = document.getElementById('citizen-modal');
        const title = document.getElementById('citizen-modal-title');
        const details = document.getElementById('citizen-details');
        const actions = document.getElementById('citizen-actions');
        
        title.textContent = citizen.name;
        details.innerHTML = Citizens.getCitizenInfo(citizen);
        
        let actionsHTML = '';
        if (citizen.job) {
            actionsHTML += `<button class="btn btn-small" onclick="Buildings.unassignCitizen('${citizen.id}'); Game.showCitizenDetailsModal('${citizenId}');">Unassign Job</button>`;
        } else {
            actionsHTML += `<button class="btn btn-small" onclick="Game.showCitizenJobAssignmentModal('${citizen.id}');">Assign Job</button>`;
        }
        
        actions.innerHTML = actionsHTML;
        modal.style.display = 'flex';
    },
    
    showCitizenJobAssignmentModal: (citizenId) => {
        const modal = document.getElementById('citizen-modal');
        const title = document.getElementById('citizen-modal-title');
        const details = document.getElementById('citizen-details');
        const actions = document.getElementById('citizen-actions');
        
        const allBuildings = Storage.getBuildings();
        const buildings = allBuildings.filter(b => !b.ownerId || b.ownerId === 'player');
        
        title.textContent = 'Assign Job';
        details.innerHTML = '<div class="list-container">' +
            buildings.map(b => {
                const buildingDef = CONFIG.BUILDINGS[b.type];
                const displayName = b.type === 'RELIGIOUS' && b.religion
                    ? Buildings.getReligionBuildingName(b.religion)
                    : buildingDef.name;
                const jobCounts = Buildings.getJobSlotsCounts(b.id);
                const available = jobCounts.available > 0;
                
                return `
                    <div class="list-item" style="opacity: ${available ? 1 : 0.5};">
                        <div class="list-item-header">${b.name}</div>
                        <div class="list-item-details">
                            ${displayName}<br>
                            Slots: ${jobCounts.used}/${b.jobSlots}
                        </div>
                        ${available ? `<button class="btn btn-small" onclick="Game.showBuildingJobsModal('${citizenId}', '${b.id}');">Assign</button>` : ''}
                    </div>
                `;
            }).join('') +
            '</div>';
        
        actions.innerHTML = `<button class="btn" onclick="Game.showCitizenDetailsModal('${citizenId}');">Back</button>`;
        modal.style.display = 'flex';
    },
    
    showBuildingJobsModal: (citizenId, buildingId) => {
        const building = Storage.getBuildings().find(b => b.id === buildingId);
        const modal = document.getElementById('citizen-modal');
        const title = document.getElementById('citizen-modal-title');
        const details = document.getElementById('citizen-details');
        const actions = document.getElementById('citizen-actions');
        
        title.textContent = `Jobs at ${building.name}`;
        
        const availableJobs = Object.entries(CONFIG.JOBS).filter(([key, job]) => {
            return !job.building || job.building === building.type.toLowerCase();
        });
        
        details.innerHTML = '<div class="list-container">' +
            availableJobs.map(([key, job]) => {
                const displayName = key === 'PRIEST' && building.religion
                    ? Buildings.getReligionJobName(building.religion)
                    : job.name;
                return `
                <div class="list-item">
                    <div class="list-item-header">${displayName}</div>
                    <div class="list-item-details">${job.description || ''}</div>
                    <button class="btn btn-small" onclick="Buildings.assignCitizenToJob('${citizenId}', '${key}', '${buildingId}'); Game.showCitizensModal();">Assign</button>
                </div>
            `;
            }).join('') +
            '</div>';
        
        actions.innerHTML = `<button class="btn" onclick="Game.showCitizenJobAssignmentModal('${citizenId}');">Back</button>`;
        modal.style.display = 'flex';
    },
    
    showBuildingsModal: () => {
        const allBuildings = Storage.getBuildings();
        const buildings = allBuildings.filter(b => !b.ownerId || b.ownerId === 'player');
        const modal = document.getElementById('buildings-modal');
        const list = document.getElementById('buildings-list');
        
        const listHTML = '<div class="list-container">' +
            (buildings.length === 0 ? '<div style="color: #707070; text-align: center; padding: 16px;">No buildings claimed yet</div>' :
            buildings.map(b => {
                const buildingDef = CONFIG.BUILDINGS[b.type];
                const displayName = b.type === 'RELIGIOUS' && b.religion
                    ? Buildings.getReligionBuildingName(b.religion)
                    : buildingDef.name;
                const jobCounts = Buildings.getJobSlotsCounts(b.id);
                
                return `
                    <div class="list-item">
                        <div class="list-item-header">${b.name}</div>
                        <div class="list-item-details">
                            Type: ${displayName}<br>
                            Level: ${b.level}
                            ${b.jobSlots ? `<br>Jobs: ${jobCounts.used}/${b.jobSlots}` : ''}
                            ${b.beds ? `<br>Beds: ${b.beds}` : ''}
                        </div>
                        <div class="list-item-actions">
                            <button class="btn btn-small" onclick="Game.selectBuilding(${JSON.stringify(b).replace(/"/g, '&quot;')});">View</button>
                        </div>
                    </div>
                `;
            }).join('')) +
            '</div>';
        
        list.innerHTML = listHTML;
        modal.style.display = 'flex';
    },
    
    showClaimOSMFeatureModal: (osmData, feature) => {
        const modal = document.getElementById('claim-building-modal');
        const titleEl = document.getElementById('claim-modal-title');
        const descEl = document.getElementById('claim-modal-description');
        const container = document.getElementById('available-buildings');
        
        const tags = osmData.tags || {};
        const locationName = OSMManager.getFeatureName(tags);
        let compatibleTypes = OSMManager.getCompatibleBuildingTypes(tags);
        
        titleEl.textContent = `Claim: ${locationName}`;
        
        // Create description from OSM tags
        let tagInfo = '';
        if (tags.building) tagInfo += `Building: ${tags.building}<br>`;
        if (tags.amenity) tagInfo += `Amenity: ${tags.amenity}<br>`;
        if (tags.shop) tagInfo += `Shop: ${tags.shop}<br>`;
        if (tags.landuse) tagInfo += `Land use: ${tags.landuse}<br>`;
        
        // Add known house description if available
        const osmIdStr = String(osmData.id);
        if (osmIdStr && osmIdStr.startsWith('known_') && CONFIG.KNOWN_HOUSES) {
            const knownHouse = CONFIG.KNOWN_HOUSES.find(h => 'known_' + h.name.replace(/\s+/g, '_') === osmIdStr);
            if (knownHouse) {
                tagInfo = `<strong>${knownHouse.description}</strong><br>Beds: ${knownHouse.beds}<br>`;
            }
        }
        
        descEl.innerHTML = tagInfo || 'Generic location';
        
        // Filter out HQ if one already exists for the player
        const allBuildings = Storage.getBuildings();
        const playerBuildings = allBuildings.filter(b => !b.ownerId || b.ownerId === 'player');
        const hqExists = playerBuildings.some(b => b.type === 'HQ');
        if (hqExists) {
            compatibleTypes = compatibleTypes.filter(t => t !== 'HQ');
        }

        compatibleTypes = compatibleTypes.filter((type) => Buildings.getBuildingTier(type) === 1);

        if (compatibleTypes.length === 0 && tags.building) {
            compatibleTypes = ['HOUSE'];
            if (!hqExists) {
                compatibleTypes.push('HQ');
            }
        }
        
        if (compatibleTypes.length === 0) {
            container.innerHTML = '<div style="color: #f87171; text-align: center; padding: 16px;">This location cannot be claimed as any building type.</div>';
            modal.style.display = 'flex';
            return;
        }
        
        // Get feature center coordinates
        const geometry = feature.getGeometry();
        let coords;
        if (geometry.getType() === 'Point') {
            coords = ol.proj.toLonLat(geometry.getCoordinates());
        } else if (geometry.getType() === 'Polygon') {
            const extent = geometry.getExtent();
            const center = [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
            coords = ol.proj.toLonLat(center);
        } else {
            coords = ol.proj.toLonLat(geometry.getFirstCoordinate());
        }
        
        const listHTML = compatibleTypes.map(type => {
            const buildingDef = CONFIG.BUILDINGS[type];
            const scrapCost = buildingDef.scrapCost || 0;
            const toolCost = buildingDef.toolCost || 0;
            const player = Storage.getPlayer();
            const preferredReligion = Resources.getPreferredReligion(player, Storage.getCitizens());
            const displayName = type === 'RELIGIOUS'
                ? Buildings.getReligionBuildingName(preferredReligion)
                : buildingDef.name;
            
            let details = buildingDef.description + '<br>';
            details += `Tier: ${Buildings.getBuildingTier(type)}<br>`;
            
            // Check for known house
            let knownHouse = null;
            const osmIdStr = String(osmData.id);
            if (osmIdStr && osmIdStr.startsWith('known_') && CONFIG.KNOWN_HOUSES) {
                knownHouse = CONFIG.KNOWN_HOUSES.find(h => 'known_' + h.name.replace(/\s+/g, '_') === osmIdStr);
            }
            
            // For HQ being claimed from a house, show HQ-specific info
            if (type === 'HQ') {
                details += 'Sets this as your Headquarters<br>';
                if (knownHouse) {
                    details += `Beds: ${knownHouse.beds}<br>`;
                } else {
                    const houseDef = CONFIG.BUILDINGS.HOUSE;
                    details += `Beds: ${houseDef.bedsMin}-${houseDef.bedsMax}<br>`;
                }
            } else {
                if (buildingDef.bedsMin) details += `Beds: ${buildingDef.bedsMin}-${buildingDef.bedsMax}<br>`;
                if (knownHouse) {
                    details += `(${knownHouse.beds} beds available)<br>`;
                } else if (tags.beds) {
                    details += `(${tags.beds} beds available)<br>`;
                }
            }
            
            if (buildingDef.jobSlots) details += `Job slots: ${buildingDef.jobSlots}<br>`;
            if (buildingDef.storageCapacity) details += `Storage: ${buildingDef.storageCapacity}<br>`;
            const costParts = [];
            if (scrapCost) costParts.push(`${scrapCost} scrap`);
            if (toolCost) costParts.push(`${toolCost} tools`);
            details += costParts.length > 0 ? `Cost: ${costParts.join(', ')}` : 'Free to claim';
            
            return `
                <div class="list-item">
                    <div class="list-item-header">${displayName}</div>
                    <div class="list-item-details">${details}</div>
                    <button class="btn btn-primary btn-small claim-building-btn" 
                        data-osm-id="${osmData.id}" 
                        data-type="${type}" 
                        data-name="${locationName}"
                        data-religion="${preferredReligion}"
                        data-lon="${coords[0]}"
                        data-lat="${coords[1]}">
                        Claim as ${displayName}
                    </button>
                </div>
            `;
        }).join('');
        
        container.innerHTML = listHTML;
        
        // Attach event listeners to claim buttons
        container.querySelectorAll('.claim-building-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const osmId = e.target.dataset.osmId;
                const type = e.target.dataset.type;
                const name = e.target.dataset.name;
                const religion = e.target.dataset.religion || null;
                const lon = parseFloat(e.target.dataset.lon);
                const lat = parseFloat(e.target.dataset.lat);
                
                Buildings.claimOSMBuilding(osmId, type, name, [lon, lat], { religion: religion });
                modal.style.display = 'none';
            });
        });
        
        modal.style.display = 'flex';
    },
    
    showGovernmentModal: () => {
        const modal = document.getElementById('government-modal');
        const player = Storage.getPlayer();
        const controlLevel = player.controlLevel || CONFIG.GOVERNMENT.defaultControl;
        
        // Control level options
        const controlContainer = document.getElementById('control-options');
        const controlHTML = Object.entries(CONFIG.GOVERNMENT.controlLevels).map(([key, level]) => {
            const isSelected = controlLevel === key;
            return `
                <div class="list-item ${isSelected ? 'selected' : ''}" style="${isSelected ? 'border-color: #4a9fd8; background: rgba(74, 159, 216, 0.2);' : ''}">
                    <div class="list-item-header">${level.name}</div>
                    <div class="list-item-details">
                        ${level.description}<br>
                        Happiness: ${level.happinessMod > 0 ? '+' : ''}${level.happinessMod}
                    </div>
                    <button class="btn btn-small ${isSelected ? 'btn-primary' : ''}" 
                        onclick="Game.setControlLevel('${key}')">
                        ${isSelected ? 'Current' : 'Select'}
                    </button>
                </div>
            `;
        }).join('');
        controlContainer.innerHTML = controlHTML;
        
        // Religion level options
        const religionContainer = document.getElementById('religion-options');
        const religionHTML = Object.entries(CONFIG.GOVERNMENT.religionLevels).map(([key, level]) => {
            const isSelected = (player.religionLevel || CONFIG.GOVERNMENT.defaultReligion) === key;
            return `
                <div class="list-item ${isSelected ? 'selected' : ''}" style="${isSelected ? 'border-color: #4a9fd8; background: rgba(74, 159, 216, 0.2);' : ''}">
                    <div class="list-item-header">${level.name}</div>
                    <div class="list-item-details">
                        ${level.description}<br>
                        Happiness: ${level.happinessMod > 0 ? '+' : ''}${level.happinessMod}
                    </div>
                    <button class="btn btn-small ${isSelected ? 'btn-primary' : ''}" 
                        onclick="Game.setReligionLevel('${key}')">
                        ${isSelected ? 'Current' : 'Select'}
                    </button>
                </div>
            `;
        }).join('');
        religionContainer.innerHTML = religionHTML;

        if ((player.religionLevel || CONFIG.GOVERNMENT.defaultReligion) === 'strict') {
            const stateReligion = player.stateReligion || CONFIG.DEMOGRAPHICS.religions[0];
            const options = CONFIG.DEMOGRAPHICS.religions.map(religion => {
                const selected = religion === stateReligion ? 'selected' : '';
                return `<option value="${religion}" ${selected}>${religion}</option>`;
            }).join('');

            religionContainer.innerHTML += `
                <div class="list-item" style="margin-top: 10px;">
                    <div class="list-item-header">State Religion</div>
                    <div class="list-item-details" style="margin: 6px 0;">Choose the official faith under strict control.</div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <select id="state-religion-select" class="btn" style="flex: 1;">
                            ${options}
                        </select>
                        <button class="btn btn-small" onclick="Game.setStateReligion(document.getElementById('state-religion-select').value);">Set</button>
                    </div>
                </div>
            `;
        }
        
        // Show job distribution section for non-free control levels
        const jobDistSection = document.getElementById('job-distribution-section');
        if (controlLevel !== 'free') {
            jobDistSection.style.display = 'block';
            
            // Get current citizen job counts
            const citizens = Storage.getCitizens();
            const jobCounts = {};
            citizens.forEach(c => {
                if (c.job) {
                    jobCounts[c.job] = (jobCounts[c.job] || 0) + 1;
                }
            });
            const idleCount = citizens.filter(c => !c.job && c.ageGroup === 'adult').length;
            
            // Build job distribution UI
            const jobContainer = document.getElementById('job-distribution-options');
            const jobHTML = Object.entries(CONFIG.JOBS).map(([jobKey, jobDef]) => {
                const jobId = jobKey.toLowerCase();
                const assigned = jobCounts[jobId] || 0;
                const capacity = Buildings.getJobCapacity(jobId);
                const availabilityText = capacity.unlimited
                    ? 'Available: Unlimited'
                    : `Available: ${capacity.availableSlots}/${capacity.totalSlots}`;
                const displayName = jobKey === 'PRIEST'
                    ? Buildings.getReligionJobName(Resources.getPreferredReligion(player, Storage.getCitizens()))
                    : jobDef.name;
                return `
                    <div class="list-item" style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div class="list-item-header">${displayName}</div>
                            <div class="list-item-details" style="font-size: 12px;">Assigned: ${assigned} (Idle: ${idleCount}) • ${availabilityText}</div>
                        </div>
                        <div style="display: flex; gap: 6px;">
                            <button class="btn btn-small" onclick="try { console.log('Button clicked:', 'ASSIGN', '${jobKey}'); Buildings.assignJob('${jobKey}'); } catch(e) { console.error(e); }" style="padding: 4px 8px; cursor: pointer;">+</button>
                            <button class="btn btn-small" onclick="try { console.log('Button clicked:', 'UNASSIGN', '${jobKey}'); Buildings.unassignJob('${jobKey}'); } catch(e) { console.error(e); }" style="padding: 4px 8px; cursor: pointer;">−</button>
                        </div>
                    </div>
                `;
            }).join('');
            jobContainer.innerHTML = jobHTML;
        } else {
            jobDistSection.style.display = 'none';
        }
        
        modal.style.display = 'flex';
    },
    
    setControlLevel: (level) => {
        const player = Storage.getPlayer();
        player.controlLevel = level;
        Storage.setPlayer(player);
        Game.showGovernmentModal(); // Refresh
        Game.addLog(`Control level changed to ${CONFIG.GOVERNMENT.controlLevels[level].name}`, 'success');
        Resources.updateUI();
    },
    
    setReligionLevel: (level) => {
        const player = Storage.getPlayer();
        player.religionLevel = level;
        if (level === 'strict') {
            player.religiousness = Math.max(player.religiousness || 0, 20);
            if (!player.stateReligion) {
                player.stateReligion = CONFIG.DEMOGRAPHICS.religions[0];
            }
        }
        Storage.setPlayer(player);
        Game.showGovernmentModal(); // Refresh
        Game.addLog(`Religious policy changed to ${CONFIG.GOVERNMENT.religionLevels[level].name}`, 'success');
        Resources.updateUI();
    },

    setStateReligion: (religion) => {
        const player = Storage.getPlayer();
        player.stateReligion = religion;
        Storage.setPlayer(player);
        Game.showGovernmentModal();
        Game.addLog(`State religion set to ${religion}`, 'success');
        Resources.updateUI();
    },
    
    showDemographicsModal: () => {
        const modal = document.getElementById('demographics-modal');
        const citizens = Storage.getCitizens();
        
        document.getElementById('demo-total').textContent = citizens.length;
        
        // Age distribution
        const ageGroups = { child: 0, adult: 0, elder: 0 };
        citizens.forEach(c => {
            ageGroups[c.ageGroup] = (ageGroups[c.ageGroup] || 0) + 1;
        });
        Game.renderChart('age-chart', ageGroups);
        
        // Gender distribution
        const genders = {};
        citizens.forEach(c => {
            genders[c.gender] = (genders[c.gender] || 0) + 1;
        });
        Game.renderChart('gender-chart', genders);
        
        // Religion distribution
        const religions = {};
        citizens.forEach(c => {
            religions[c.religion] = (religions[c.religion] || 0) + 1;
        });
        Game.renderChart('religion-chart', religions);
        
        // Ethnicity distribution
        const ethnicities = {};
        citizens.forEach(c => {
            ethnicities[c.ethnicity] = (ethnicities[c.ethnicity] || 0) + 1;
        });
        Game.renderChart('ethnicity-chart', ethnicities);
        
        modal.style.display = 'flex';
    },
    
    renderChart: (containerId, data) => {
        const container = document.getElementById(containerId);
        const total = Object.values(data).reduce((sum, val) => sum + val, 0);
        
        if (total === 0) {
            container.innerHTML = '<div style="color: #707070; text-align: center; padding: 16px;">No data yet</div>';
            return;
        }
        
        const html = Object.entries(data)
            .sort((a, b) => b[1] - a[1])
            .map(([label, count]) => {
                const percent = ((count / total) * 100).toFixed(1);
                return `
                    <div style="margin: 6px 0;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <span style="color: #e0e0e0;">${label}</span>
                            <span style="color: #4a9fd8;">${count} (${percent}%)</span>
                        </div>
                        <div style="background: rgba(0,0,0,0.3); height: 8px; border-radius: 4px; overflow: hidden;">
                            <div style="background: linear-gradient(90deg, #2a6ea6, #4a9fd8); height: 100%; width: ${percent}%; transition: width 0.3s;"></div>
                        </div>
                    </div>
                `;
            }).join('');
        
        container.innerHTML = html;
    },
    
    showClaimBuildingModal: () => {
        // Deprecated - now using OSM features
        Game.addLog('Click on green buildings on the map to claim them', 'info');
    },
};

// Initialize on page load
console.log('🎮 game.js loaded - waiting for DOMContentLoaded...');
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 DOMContentLoaded fired!');
    Game.init();
    
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .catch(err => console.log('Service Worker registration failed:', err));
    }
});

window.Game = Game;

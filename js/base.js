// Base building and management
const Base = {
    buildBase: (location) => {
        const player = Storage.getPlayer();
        
        // Check if location already has a base
        const existing = Storage.getBases().find(b => 
            Math.abs(b.location[0] - location[0]) < 0.001 &&
            Math.abs(b.location[1] - location[1]) < 0.001
        );
        if (existing) {
            Game.addLog('Base already exists here!', 'error');
            return false;
        }
        
        // Create base
        const newBase = {
            location: location,
            name: `Base ${Storage.getBases().length + 1}`,
            level: 1,
            defense: 10,
            garrison: 5,
            createdAt: Date.now(),
        };
        
        const savedBase = Storage.addBase(newBase);
        MapManager.addBaseMarker(savedBase);
        
        // Award XP
        Resources.addXP(CONFIG.xpPerBase);
        
        Game.addLog(`Base "${newBase.name}" built successfully!`, 'success');
        return true;
    },
    
    upgradeBase: (baseId) => {
        const base = Storage.getBases().find(b => b.id === baseId);
        if (!base) return false;
        
        base.level += 1;
        base.defense += 5;
        base.garrison += 2;
        
        Storage.updateBase(baseId, base);
        MapManager.updateBaseMarker(baseId);
        
        Resources.addXP(CONFIG.xpPerBase * 2);
        Game.addLog(`Base upgraded to level ${base.level}!`, 'success');
        
        return true;
    },
    
    getBaseInfo: (base) => {
        return `
            <div class="base-info">
                <strong>${base.name}</strong><br>
                Level: ${base.level}<br>
                Defense: ${base.defense}<br>
                Garrison: ${base.garrison}<br>
                Location: ${base.location[0].toFixed(4)}, ${base.location[1].toFixed(4)}<br>
                Created: ${new Date(base.createdAt).toLocaleDateString()}
            </div>
        `;
    },
};

window.Base = Base;

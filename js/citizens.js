// Citizens management
const Citizens = {
    hireCitizen: () => {
        const citizen = Storage.addCitizen();
        Game.addLog('New citizen has arrived!', 'success');
        return citizen;
    },
    
    getCitizenStats: () => {
        const citizens = Storage.getCitizens();
        const jobCounts = {};
        
        citizens.forEach(c => {
            if (c.job) {
                jobCounts[c.job] = (jobCounts[c.job] || 0) + 1;
            }
        });
        
        return {
            total: citizens.length,
            idle: citizens.filter(c => !c.job).length,
            farmers: jobCounts['farming'] || 0,
            gatherers: jobCounts['gathering'] || 0,
            scavengers: jobCounts['scavenging'] || 0,
            soldiers: jobCounts['military'] || 0,
        };
    },
};

window.Citizens = Citizens;

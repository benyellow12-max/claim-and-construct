# Citizen & Building Management Guide

## Overview

Your empire now depends on managing citizens and buildings. Citizens need food and housing, and they can be assigned to jobs that produce various resources.

## Citizens

### Hiring & Management
- **Hire Citizens**: Click the "Citizens" button, then "Hire Citizen (50 coins)"
- **Dismiss Citizens**: Click a citizen's "Dismiss" button
- **Reassign Jobs**: Click a citizen's "Details", then reassign to a different job or make them idle

### Citizen Needs
- Each citizen consumes **1 food/second** (regardless of job)
- Citizens also consume additional food/seeds/scrap based on their job
- If food drops too low, citizens will starve and die
- Citizens need **beds** in housing buildings to avoid homelessness

## Buildings

### Claiming Buildings
1. Click the "Buildings" button
2. Click "Claim New Building"
3. Select a building from the list and click "Claim"
4. Each building type has specific costs and benefits

### Building Types

#### House (Residential)
- **Cost**: 150 coins
- **Provides**: 6-12 beds and 100+ storage
- **No jobs** - purely for housing and storage
- Upgrade to increase bed/storage capacity

#### Farm
- **Cost**: 200 coins + seeds consumed
- **Job Slots**: 5 farmers
- **Requires**: Seeds to function
- **Produces**: 2 food/citizen/sec (net +1 food after consumption)
- **Also requires**: A gathering station to generate seeds

#### Gathering Station
- **Cost**: 250 coins
- **Job Slots**: 4 gatherers
- **Produces**: 1.5 food + 0.3 seeds/citizen/sec
- **Key building**: Required to generate seeds for farming

#### Warehouse (Storage)
- **Cost**: 300 coins
- **Provides**: 300 storage capacity
- **No jobs** - purely for resource storage
- Upgrade to expand storage

#### Armory (Military)
- **Cost**: 400 coins + 100 scrap
- **Job Slots**: 3 soldiers
- **Produces**: 1 troop/citizen/sec
- Requires scrap (from scavengers) for equipment maintenance

### Resource Storage & Requirements

**Storage**: Resources take up storage space:
- Food: 1 storage per unit
- Seeds: 0.5 storage per unit
- Scrap: 0.3 storage per unit

**Housing**: Citizens need beds:
- 1 bed needed per citizen
- Build houses to get beds
- Check "Beds" stat in Resources panel

## Jobs

### Job Types & Production

| Job | Building | Consumes | Produces | Good For |
|-----|----------|----------|----------|----------|
| Farmer | Farm | 1 food, 0.05 seeds | 2 food | Food production (with seeds) |
| Gatherer | Gathering Station | 0.8 food | 1.5 food, 0.3 seeds | Seed generation |
| Scavenger | None | 0.5 food | 0.2 scrap | Scrap for complex buildings |
| Soldier | Armory | 1.2 food | 1 troop | Military units |

### Best Practices

1. **Start with Gatherers**
   - Build a Gathering Station first
   - Assign 1-2 citizens to gathering
   - This generates seeds for farming

2. **Then Build Farms**
   - Seeds + Farmers = Food production
   - Each farmer needs seeds to work

3. **Expand Housing**
   - Build Houses as population grows
   - Houses provide storage too

4. **Add Scavengers**
   - Don't require buildings
   - Generate scrap for complex builds
   - Useful for late-game buildings

5. **Military (Late Game)**
   - Build Armory when you have scrap
   - Soldiers require feeding but generate troops
   - Use for base defense/attack

## Resource Flow Example

```
Gatherers (at Gathering Station)
  ↓
  Produces: Seeds + Food
  ↓
  Farmers use seeds at Farm
  ↓
  Farmers produce more food than they consume
  ↓
  Excess food feeds idle citizens & soldiers
```

## Tips

- **Balance is key**: Don't make too many soldiers early; they eat a lot
- **Plan housing**: Each new citizen needs a bed
- **Seed management**: Always keep gatherers running to generate seeds
- **Storage needs**: Build warehouses before you run out of space
- **Scrap sources**: Scavengers are the only way to get scrap (besides initial supply)

## Starvation & Death

- Citizens die if there's not enough food
- Population will naturally decline if food production < consumption
- Plan your food production carefully!

## Growth & Sustainability

- Citizens occasionally reproduce (very slowly) if there are available beds
- A sustainable society needs: homes → food production → job variety
- Start small, grow gradually, expand strategically

Enjoy building your empire! 🏛️

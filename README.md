# Claim and Construct 🎮

A real-world map-based strategy game where you build and manage bases on actual locations from OpenStreetMap data.

## Features

### MVP (Current)
- **Real-World Map**: Interactive map using OpenLayers with OpenStreetMap tiles
- **Base Building**: Claim locations and build bases
- **Resource System**: Coins and troops generated passively, with higher production on upgraded bases
- **Leveling System**: Gain XP by building and upgrading bases
- **Persistent Storage**: All game data saved to browser local storage
- **PWA Support**: Can be installed as a standalone app on mobile devices

### Planned Features
- Multiplayer support (alliances, base invasions)
- Building variety and upgrading trees
- Special abilities and units
- Player markets for trading
- Achievements and leaderboards
- NPC raids and events

## Project Structure

```
claim-and-construct-game/
├── index.html           # Main HTML file
├── styles.css          # Game styling
├── manifest.json       # PWA manifest
└── js/
    ├── config.js       # Game configuration constants
    ├── storage.js      # LocalStorage management
    ├── map.js          # Map initialization (OpenLayers)
    ├── resources.js    # Coin/troop/XP management
    ├── base.js         # Base building and management
    └── game.js         # Main game logic
```

## How to Play

1. **Open the Game**: Open `index.html` in a web browser
2. **Start Game**: Enter your player name and click "Start Game"
3. **Navigate Map**: Zoom and pan around the map to explore
4. **Find Locations**: Click on any location to view details
5. **Build Base**: Click "Build Base" on an unclaimed location (costs coins and troops)
6. **Upgrade**: Click "Upgrade Base" to increase production and defenses
7. **Locate Me**: Use the "Locate Me" button for GPS positioning
8. **Monitor Resources**: Check the top-left panel for your current stats

## Game Mechanics

### Resources
- **Coins**: Main currency, earned passively (1/s base rate)
- **Troops**: Military units, earned passively (0.5/s base rate)
- **XP**: Experience points, earned by building bases

### Bases
- Build on any map location with minimum cost
- Each base generates passive income
- Upgrade bases to increase production and defenses
- Higher level bases generate more resources

### Building Costs
- **Build**: 100 coins + 20 troops
- **Upgrade**: 100 × (level + 1) coins

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers with geolocation support

## Local Development

1. Clone this repository
2. Open `index.html` directly in a browser (no server needed initially)
3. For PWA features and geolocation, use a local web server:

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js
npx http-server
```

Then navigate to `http://localhost:8000`

## GitHub Setup

1. Push this project to a GitHub repository
2. In the repository settings, open **Pages**
3. Under **Build and deployment**, set **Source** to **GitHub Actions**
4. Push to the `main` branch to trigger automatic deployment

The workflow file is at `.github/workflows/deploy-pages.yml` and publishes the app to GitHub Pages.

## Future Development

### Phase 2: Multiplayer
- WebSocket server for real-time updates
- Player alliances
- Base raids and defense mechanics
- Trade system

### Phase 3: Advanced Content  
- Building variety based on real OSM building types
- Special events and NPC interactions
- Army and combat system overhaul
- World events and seasonal content

## API References

### Core Modules

#### MapManager
- `init()`: Initialize the map
- `addBaseMarker(base)`: Add a marker for a base
- `updateBaseMarker(baseId)`: Update a base marker
- `locatePlayer()`: Center map on current location
- `centerOn(lonLat)`: Animate to coordinates

#### Resources
- `update()`: Automatic resource generation
- `spendCoins(amount)`: Deduct coins
- `spendTroops(amount)`: Deduct troops
- `addXP(amount)`: Add experience points

#### Base
- `buildBase(location)`: Build a new base
- `upgradeBase(baseId)`: Upgrade existing base

#### Storage
- `getPlayer()`: Get player data
- `getBases()`: Get all bases
- `addBase(baseData)`: Create and save base
- `updateBase(baseId, updates)`: Update base properties

## License

MIT (see `LICENSE`)

## Contributing

Feel free to extend the game! Some ideas:
- Different base types
- Research trees for progression
- Procedural base names
- Sound effects and music
- More detailed base visualization
- Mobile touch controls

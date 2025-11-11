# D3: World of Bits

## Game Design Vision

In this game, much like in Pokemon Go, players move about the real world collecting and depositing items in locations that are only interactable when the player is sufficiently close to them. Like in 4096 and Threes, players will primarily be crafting tokens of higher and higher value by combining tokens of lesser value. In particular, only tokens of identical value can be combined, and the result is always a single token of twice the value of an ingredient token. In order to accommodate playing this game out in the real world (e.g. taking the campus shuttle to reach fresh locations), the game needs to run comfortably in a mobile browser and support gameplay across browser sessions (i.e. players can close the browser tab without losing progress in the game).

## Technologies

- TypeScript for most game code, little to no explicit HTML, and all CSS collected in common `style.css` file
- Deno and Vite for building
- GitHub Actions + GitHub Pages for deployment automation

## Assignments

### D3.a: Core mechanics (token collection and crafting)

Key technical challenge: Can you assemble a map-based user interface using the Leaflet mapping framework?
Key gameplay challenge: Can players collect and craft tokens from nearby locations to finally make one of sufficiently high value?

#### D3.a Steps

- [x] copy main.ts to reference.ts for future reference
- [x] delete everything in main.ts
- [x] put a basic leaflet map on the screen
- [x] draw the player's location on the map
- [x] draw a rectangle representing one cell on the map
- [x] use loops to draw a whole grid of cells on the map (only the size of the screen)
- [x] create a way to store information about a cell (token, token value)
- [x] use luck function to set up token spawning
- [x] display cell information on map with text
- [x] implement cell clicking to collect so it clears the cell
- [x] implement inventory -- collect if not holding a token or value != holding token value
- [x] implement combine mechanic (if value == holding token value)
- [x] visually change cells on collect or combine
- [x] implement collecting constraints (collect dist == 3)

### D3.b: Globe-spanning gameplay

Key technical challenge: Can you set up your implementation to support gameplay anywhere in the real world, not just locations near our classroom?
Key gameplay challenge: Can players craft an even higher value token by moving to other locations to get access to additional crafting materials?

#### D3.b Steps

- [x] write updated plan.md for D3.b steps
- [x] identify any places for refactoring before making new changes
- [x] add cell interface that just hold i,j pairs
- [x] add functions for converting between cells and bounds
- [x] change current cache drawing algorithm so 0,0 is centered on a cache
- [x] make it so player position is always centered on a cache
- [x] add up/down/left/right buttons to the screen
- [x] link buttons to player icon movement by 1 grid space
- [x] add cache spawning that triggers whenever the player stops moving (using map.on("moveend"), etc)
- [ ] clear map before redrawing

# Bookmark Manager

A powerful, modern bookmark management application built with Vue 3, TypeScript, and Rust WebAssembly. Features an interactive canvas-based tree visualization with drag-and-drop support, duplicate detection, tag management, and multi-format export capabilities.

## Features

### Core Functionality
- **📁 Import & Parse**: Parse HTML bookmark files in Netscape format (Chrome, Firefox, Edge compatible)
- **🌳 Interactive Tree Visualization**: Canvas-based tree rendering with D3.js for smooth performance
- **🎯 Drag & Drop**: Move nodes with precise positioning (before/after siblings, or inside folders)
- **🔍 Smart Search**: Search by title, URL, or tags with real-time highlighting
- **🏷️ Tag Management**: Add, remove, rename, and filter by tags
- **📊 Duplicate Detection**: Automatically identify and resolve duplicate bookmarks
- **💾 Persistent Storage**: IndexedDB-based storage for offline access
- **↩️ Undo/Redo**: Full history support for all operations
- **📤 Multi-Format Export**: Export to HTML, JSON, CSV, or Markdown

### User Interface
- **Canvas Rendering**: High-performance visualization for large bookmark trees (2000+ nodes)
- **Zoom & Pan**: Smooth navigation with mouse wheel zoom and drag-to-pan
- **Context Menu**: Right-click menu for quick actions
- **Detail Panel**: View comprehensive node information and statistics
- **Responsive Design**: Modern UI with Ant Design Vue components
- **Visual Indicators**: Color-coded nodes (folders, bookmarks, tagged items, duplicates, search results)

### Advanced Features
- **Merge Multiple Files**: Combine bookmarks from multiple sources
- **Folder Statistics**: View direct and total counts of bookmarks and folders
- **Keyboard Shortcuts**: Space + drag for panning
- **Auto-Expansion**: Smart default expansion for folder nodes
- **Large Tree Optimization**: Automatic performance optimization for trees with 2000+ nodes

## Tech Stack

### Frontend
- **Vue 3** - Progressive JavaScript framework with Composition API
- **TypeScript** - Type-safe development
- **Pinia** - State management
- **Ant Design Vue** - UI component library
- **D3.js** - Data visualization and tree layout
- **Dexie.js** - IndexedDB wrapper for data persistence

### Backend (WebAssembly)
- **Rust** - High-performance bookmark processing
- **wasm-bindgen** - Rust/JavaScript interop
- **scraper** - HTML parsing
- **serde** - Serialization/deserialization

### Build Tools
- **Vite** - Fast build tool and dev server
- **wasm-pack** - Rust to WebAssembly compiler
- **TypeScript Compiler** - Type checking

## Prerequisites

- **Node.js**: v24.13.0 or higher (managed via Volta)
- **Rust**: Latest stable version
- **wasm-pack**: For building WebAssembly modules

### Installing Prerequisites

```bash
# Install Node.js (using Volta - recommended)
curl https://get.volta.sh | bash
volta install node@24.13.0

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

## Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd bookmarks
```

2. **Install dependencies**
```bash
npm install
```

3. **Build WebAssembly module**
```bash
npm run build:wasm
```

## Development

### Start Development Server

```bash
# Start Vite dev server (with hot reload)
npm run dev
```

The application will be available at `http://localhost:5173`

### Build WebAssembly (Development Mode)

```bash
# Build WASM with debug symbols
npm run dev:wasm
```

### Build WebAssembly (Production Mode)

```bash
# Build optimized WASM
npm run build:wasm
```

## Building for Production

```bash
# Build both TypeScript and WebAssembly
npm run build

# Preview production build
npm run preview
```

The production build will be output to the `dist/` directory.

## Project Structure

```
bookmarks/
├── src/                          # Vue application source
│   ├── components/               # Vue components
│   │   ├── BookmarkTreeCanvas.vue    # Main tree visualization
│   │   ├── EditBookmarkModal.vue     # Edit/add bookmark modal
│   │   ├── FileUpload.vue            # File upload component
│   │   └── ...
│   ├── composables/              # Vue composables
│   │   └── useCanvasTree.ts          # Canvas tree logic
│   ├── stores/                   # Pinia stores
│   │   ├── bookmarkStore.ts          # Bookmark data management
│   │   └── uiStore.ts                # UI state management
│   ├── db/                       # IndexedDB layer
│   │   ├── repository.ts             # Data access layer
│   │   └── schema.ts                 # Database schema
│   ├── utils/                    # Utility functions
│   │   ├── wasmBridge.ts             # Rust WASM bridge
│   │   └── treeUtils.ts              # Tree manipulation utilities
│   ├── App.vue                   # Root component
│   └── main.ts                   # Application entry point
├── src-rust/                     # Rust WebAssembly source
│   ├── src/
│   │   └── lib.rs                    # Rust implementation
│   └── Cargo.toml                    # Rust dependencies
├── public/                       # Static assets
│   └── wasm/                         # Compiled WASM modules
├── index.html                    # HTML entry point
├── vite.config.ts               # Vite configuration
├── tsconfig.json                # TypeScript configuration
└── package.json                 # Node.js dependencies

```

## Usage

### Importing Bookmarks

1. Click the **"Upload Bookmark File"** button
2. Select an HTML bookmark file (exported from Chrome, Firefox, or Edge)
3. The bookmarks will be parsed and displayed in the tree view

### Navigating the Tree

- **Click folder**: Expand/collapse folder
- **Click bookmark**: View details in side panel
- **Right-click**: Open context menu
- **Drag node**: Move to new location
- **Mouse wheel**: Zoom in/out
- **Space + Drag**: Pan the canvas
- **Drag to drop zones**:
  - Blue circle around node: Drop inside folder
  - Blue line above node: Drop before sibling
  - Blue line below node: Drop after sibling

### Managing Bookmarks

- **Edit**: Right-click → Edit, or click bookmark → Edit button
- **Delete**: Right-click → Delete, or click bookmark → Delete button
- **Add Child**: Right-click folder → Add Child Node
- **Add Sibling**: Right-click any node → Add Sibling Node
- **Add Tags**: Edit bookmark and add tags in the tags field
- **Search**: Use the search bar to find bookmarks by title, URL, or tag

### Merging Files

1. Upload multiple bookmark files
2. Select files to merge from the file list
3. Click **"Merge Selected Files"**
4. Review and resolve any duplicates

### Exporting Bookmarks

1. Click **"Export"** button
2. Choose format (HTML, JSON, CSV, or Markdown)
3. Preview the export
4. Click **"Download"** to save

## Keyboard Shortcuts

- **Space + Drag**: Pan the canvas
- **Mouse Wheel**: Zoom in/out
- **Ctrl/Cmd + Z**: Undo (when available)
- **Ctrl/Cmd + Shift + Z**: Redo (when available)

## Performance

- **Small Trees** (< 2000 nodes): All folders expanded by default
- **Large Trees** (≥ 2000 nodes): Only top-level folders expanded by default
- **Canvas Rendering**: Optimized for smooth 60fps rendering
- **Lazy Loading**: Nodes are only rendered when visible

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support (requires WebAssembly support)

## Development Notes

### Adding New Features

1. **Rust Functions**: Add to `src-rust/src/lib.rs` with `#[wasm_bindgen]` attribute
2. **TypeScript Bridge**: Export in `src/utils/wasmBridge.ts`
3. **Store Methods**: Add to `src/stores/bookmarkStore.ts`
4. **UI Components**: Create in `src/components/`

### Rebuilding WASM

After modifying Rust code, rebuild the WASM module:

```bash
npm run build:wasm
```

The dev server will automatically reload.

### Database Schema

The application uses IndexedDB with three stores:
- **files**: Uploaded bookmark files
- **mergedTree**: Merged bookmark tree
- **tags**: Tag statistics

## Troubleshooting

### WASM Build Fails

```bash
# Ensure Rust and wasm-pack are installed
rustc --version
wasm-pack --version

# Clean and rebuild
cd src-rust
cargo clean
cd ..
npm run build:wasm
```

### "Write operation failed: computed value is readonly"

This warning has been fixed in the latest version. If you still see it, ensure you're using the latest code.

### Tree Not Rendering

1. Check browser console for errors
2. Ensure WASM module is built: `npm run build:wasm`
3. Clear browser cache and reload

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with [Vue 3](https://vuejs.org/)
- UI components from [Ant Design Vue](https://antdv.com/)
- Tree visualization powered by [D3.js](https://d3js.org/)
- High-performance parsing with [Rust](https://www.rust-lang.org/) and [WebAssembly](https://webassembly.org/)

## Roadmap

- [ ] Cloud sync support
- [ ] Browser extension
- [ ] Mobile app
- [ ] Collaborative editing
- [ ] Advanced filtering and sorting
- [ ] Bookmark health check (detect broken links)
- [ ] Import from other formats (JSON, CSV)
- [ ] Themes and customization

---

**Made with ❤️ using Vue 3, TypeScript, and Rust**

import express from 'express'
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync, createReadStream, unlinkSync } from 'fs'
import { join, dirname, basename, extname, relative, resolve } from 'path'
import { createHash } from 'crypto'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST_DIR = join(__dirname, 'dist')
const DEBUG = process.env.DEBUG !== 'false'
const SCAN_INTERVAL = 30000

if (DEBUG) console.log('[Music Player] Debug mode enabled')

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.wma', '.opus'])

const MIME_TYPES = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.wma': 'audio/x-ms-wma',
    '.opus': 'audio/opus',
}

const app = express()
app.use(express.json())
app.use(express.static(DIST_DIR))

// --- Helpers ---
function generateId(filePath) {
    return createHash('md5').update(filePath).digest('hex')
}

// --- Music database (in-memory cache) ---
let musicDb = { files: [], categories: [] }

function getDataDir() {
    return process.env.DATA_DIR || '/'
}

function getDbPath() {
    return join(getDataDir(), 'music-db.json')
}

function saveDb() {
    try {
        writeFileSync(getDbPath(), JSON.stringify(musicDb, null, 2))
    } catch (err) {
        if (DEBUG) console.error('Failed to save music DB:', err.message)
    }
}

function loadDb() {
    try {
        const dbPath = getDbPath()
        if (existsSync(dbPath)) {
            const data = JSON.parse(readFileSync(dbPath, 'utf-8'))
            if (data && Array.isArray(data.files)) {
                musicDb = data
                if (DEBUG) console.log(`[DB] Loaded ${musicDb.files.length} files from cache`)
                return true
            }
        }
    } catch (err) {
        if (DEBUG) console.error('Failed to load music DB:', err.message)
    }
    return false
}

function isAudioFile(filename) {
    const ext = extname(filename).toLowerCase()
    return AUDIO_EXTENSIONS.has(ext)
}

function scanAudioFiles(dirPath, categoryName = null, maxDepth = 10, currentDepth = 0) {
    const results = []
    if (currentDepth > maxDepth || !existsSync(dirPath)) return results

    try {
        const entries = readdirSync(dirPath)
        for (const name of entries) {
            const fullPath = join(dirPath, name)
            try {
                const stat = statSync(fullPath)
                if (stat.isDirectory()) {
                    results.push(...scanAudioFiles(fullPath, name, maxDepth, currentDepth + 1))
                } else if (isAudioFile(name)) {
                    const relativePath = relative(dirPath, fullPath)
                    results.push({
                        id: generateId(relativePath),
                        category: categoryName,
                        name,
                        path: relativePath,
                        fullPath,
                        size: stat.size,
                        mtime: stat.mtime.toISOString(),
                        duration: null,
                    })
                }
            } catch {
                // skip inaccessible entries
            }
        }
    } catch {
        // skip inaccessible directories
    }

    return results
}

function countAudioFiles(dirPath) {
    let count = 0
    try {
        for (const name of readdirSync(dirPath)) {
            const fullPath = join(dirPath, name)
            try {
                const stat = statSync(fullPath)
                if (stat.isDirectory()) {
                    count += countAudioFiles(fullPath)
                } else if (isAudioFile(name)) {
                    count++
                }
            } catch {}
        }
    } catch {}
    return count
}

function scanDirs(dirPath, maxDepth = 10, currentDepth = 0) {
    const categories = []
    if (currentDepth > maxDepth || !existsSync(dirPath)) return categories

    try {
        for (const name of readdirSync(dirPath)) {
            const fullPath = join(dirPath, name)
            try {
                const stat = statSync(fullPath)
                if (stat.isDirectory()) {
                    const count = countAudioFiles(fullPath)
                    if (count > 0) {
                        categories.push({
                            id: `dir:${generateId(name)}`,
                            label: name,
                            dirName: name,
                            count,
                        })
                        categories.push(...scanDirs(fullPath, maxDepth, currentDepth + 1))
                    }
                }
            } catch {}
        }
    } catch {}

    categories.sort((a, b) => a.label.localeCompare(b.label))
    return categories
}

function doScan() {
    const dirPath = getDataDir()
    if (DEBUG) console.log(`[Scan] Scanning: ${dirPath}`)

    const files = scanAudioFiles(dirPath)
    files.sort((a, b) => a.name.localeCompare(b.name))

    const categories = [{ id: 'all', label: null, dirName: null, count: files.length }, ...scanDirs(dirPath)]
    const newDb = { files, categories }

    if (JSON.stringify(musicDb) === JSON.stringify(newDb)) {
        if (DEBUG) console.log('[Scan] No changes detected, skipping DB write')
        return musicDb
    }

    musicDb = newDb
    saveDb()

    if (DEBUG) console.log(`[Scan] Found ${files.length} audio files (DB updated)`)
    if (DEBUG && files.length > 0) {
        files.slice(0, 5).forEach(f => console.log(`  -> id=${f.id} path=${f.path}`))
        if (files.length > 5) console.log(`  ... and ${files.length - 5} more`)
    }
    if (DEBUG) console.log(`[Scan] Categories: ${categories.map(c => `${c.label || 'all'}(${c.count})`).join(', ')}`)

    return musicDb
}

function findFileById(id) {
    return musicDb.files.find(f => f.id === id)
}

// --- Favorites ---
function getFavoritesPath() {
    return join(getDataDir(), 'favorites.json')
}

function readFavorites() {
    const favPath = getFavoritesPath()
    try {
        if (existsSync(favPath)) {
            return JSON.parse(readFileSync(favPath, 'utf-8'))
        }
    } catch {}
    return []
}

function writeFavorites(favorites) {
    const favPath = getFavoritesPath()
    writeFileSync(favPath, JSON.stringify(favorites, null, 2))
}

// --- Music database endpoint ---
app.get('/api/audio/db', (req, res) => {
    res.json(musicDb)
})

// --- Audio scan ---
app.get('/api/audio/scan', (req, res) => {
    res.json(musicDb)
})

app.post('/api/audio/scan', (req, res) => {
    try {
        const db = doScan()
        res.json(db)
    } catch (err) {
        if (DEBUG) console.error('Scan error:', err.message)
        res.status(500).json({ error: err.message })
    }
})

// --- Audio stream (id or path) ---
app.get('/api/audio/stream', (req, res) => {
    try {
        let file = null

        if (req.query.id) {
            file = findFileById(req.query.id)
        } else if (req.query.path) {
            // fallback: find by path
            file = musicDb.files.find(f => f.path === req.query.path)
        }

        if (!file) {
            return res.status(404).json({ error: 'File not found' })
        }

        const filePath = file.fullPath

        if (DEBUG) console.log(`[Stream] id=${file.id} path=${file.path} filePath=${filePath} exists=${existsSync(filePath)}`)

        if (!existsSync(filePath)) {
            if (DEBUG) console.error(`[Stream] 404 - File not found on disk: ${filePath}`)
            return res.status(404).json({ error: 'File not found on disk' })
        }

        const stat = statSync(filePath)
        if (stat.isDirectory()) {
            return res.status(400).json({ error: 'Cannot stream a directory' })
        }

        const ext = extname(filePath).toLowerCase()
        const contentType = MIME_TYPES[ext] || 'application/octet-stream'

        const range = req.headers.range
        if (range) {
            const parts = range.replace(/bytes=/, '').split('-')
            const start = parseInt(parts[0], 10)
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1
            const chunkSize = end - start + 1

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': contentType,
            })
            createReadStream(filePath, { start, end }).pipe(res)
        } else {
            res.writeHead(200, {
                'Content-Length': stat.size,
                'Content-Type': contentType,
            })
            createReadStream(filePath).pipe(res)
        }
    } catch (err) {
        if (DEBUG) console.error('Stream error:', err.message)
        res.status(500).json({ error: err.message })
    }
})

// --- Audio metadata (id or path) ---
app.get('/api/audio/metadata', async (req, res) => {
    try {
        let file = null

        if (req.query.id) {
            file = findFileById(req.query.id)
        } else if (req.query.path) {
            file = musicDb.files.find(f => f.path === req.query.path)
        }

        if (!file) {
            return res.status(404).json({ error: 'File not found' })
        }

        const filePath = file.fullPath

        if (!existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found on disk' })
        }

        try {
            const { parseFile } = await import('music-metadata')
            const metadata = await parseFile(filePath)
            res.json({
                title: metadata.common.title || basename(filePath, extname(filePath)),
                artist: metadata.common.artist || 'Unknown Artist',
                album: metadata.common.album || 'Unknown Album',
                duration: metadata.format.duration || null,
                year: metadata.common.year || null,
                genre: metadata.common.genre || null,
                picture: metadata.common.picture?.[0] || null,
            })
        } catch {
            res.json({
                title: basename(filePath, extname(filePath)),
                artist: 'Unknown Artist',
                album: 'Unknown Album',
                duration: null,
                year: null,
                genre: null,
                picture: null,
            })
        }
    } catch (err) {
        if (DEBUG) console.error('Metadata error:', err.message)
        res.status(500).json({ error: err.message })
    }
})

// --- Audio delete (by id) ---
app.delete('/api/audio/delete', (req, res) => {
    try {
        const id = req.query.id || req.body?.id
        if (!id) {
            return res.status(400).json({ error: 'ID is required' })
        }

        const file = findFileById(id)
        if (!file) {
            return res.status(404).json({ error: 'File not found' })
        }

        const filePath = file.fullPath
        if (!existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found on disk' })
        }

        const stat = statSync(filePath)
        if (stat.isDirectory()) {
            return res.status(400).json({ error: 'Cannot delete a directory' })
        }

        unlinkSync(filePath)

        // Remove from favorites if present
        const favorites = readFavorites()
        const newFavorites = favorites.filter(f => f !== id)
        if (newFavorites.length !== favorites.length) {
            writeFavorites(newFavorites)
        }

        // Rescan after delete
        doScan()

        if (DEBUG) console.log(`Deleted: ${file.path} (id=${id})`)
        res.json({ success: true })
    } catch (err) {
        if (DEBUG) console.error('Delete error:', err.message)
        res.status(500).json({ error: err.message })
    }
})

// --- Favorites (stored as id array) ---
app.get('/api/favorites', (req, res) => {
    try {
        const favorites = readFavorites()
        res.json({ favorites })
    } catch (err) {
        if (DEBUG) console.error('Get favorites error:', err.message)
        res.status(500).json({ error: err.message })
    }
})

app.post('/api/favorites', (req, res) => {
    try {
        const { id } = req.body
        if (!id) {
            return res.status(400).json({ error: 'ID is required' })
        }

        const favorites = readFavorites()
        if (!favorites.includes(id)) {
            favorites.push(id)
            writeFavorites(favorites)
        }

        res.json({ favorites })
    } catch (err) {
        if (DEBUG) console.error('Add favorite error:', err.message)
        res.status(500).json({ error: err.message })
    }
})

app.delete('/api/favorites', (req, res) => {
    try {
        const id = req.query.id || req.body?.id
        if (!id) {
            return res.status(400).json({ error: 'ID is required' })
        }

        let favorites = readFavorites()
        favorites = favorites.filter(f => f !== id)
        writeFavorites(favorites)

        res.json({ favorites })
    } catch (err) {
        if (DEBUG) console.error('Remove favorite error:', err.message)
        res.status(500).json({ error: err.message })
    }
})

// --- Config ---
app.get('/api/config', (req, res) => {
    res.json({ dataDir: getDataDir() })
})

// --- SPA fallback ---
app.get('*', (req, res) => {
    res.sendFile(join(DIST_DIR, 'index.html'))
})

// --- Startup: load cache or scan ---
const loadedFromCache = loadDb()
if (!loadedFromCache) {
    doScan()
}

// --- Periodic scan ---
setInterval(() => {
    doScan()
}, SCAN_INTERVAL)

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
    console.log(`Music Player server running on port ${PORT} (${musicDb.files.length} tracks)`)
})

const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const app = express();
const port = 3000;

// Configuration de Multer pour les uploads d'images
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dir = path.join(__dirname, 'data/pics');
    try {
      await fs.mkdir(dir, { recursive: true });
      cb(null, dir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, uniqueName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté (JPEG, JPG, PNG, GIF uniquement)'));
    }
  }
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));
app.use('/data', express.static('data'));

// Middleware pour les erreurs
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err.stack);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Erreur d'upload: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

// Parser un fichier JSON
async function parseJson(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(filePath, '[]', 'utf8');
      return [];
    }
    throw error;
  }
}

// Écrire un fichier JSON
async function writeJson(filePath, items) {
  try {
    await fs.writeFile(filePath, JSON.stringify(items, null, 2), 'utf8');
  } catch (error) {
    throw error;
  }
}

// Vérifier les dépendances avant suppression
async function checkDependencies(category, id, force = false) {
  if (category === 'locations' && !force) {
    const filePath = path.join(__dirname, 'data/cultures.json');
    const cultures = await parseJson(filePath).catch(() => []);
    if (cultures.some(c => c.Lieu === id)) {
      throw new Error('Lieu utilisé dans une culture');
    }
  }
  if (category === 'cultures') {
    const filePath = path.join(__dirname, 'data/harvests.json');
    const harvests = await parseJson(filePath).catch(() => []);
    if (harvests.some(h => h.Culture === id)) {
      throw new Error('Culture utilisée dans une récolte');
    }
  }
  // Pas de vérification pour les graines
}

// Endpoint pour récupérer les espèces
app.get('/api/species', async (req, res) => {
  try {
    const filePath = path.join(__dirname, 'data', 'species.json');
    const species = await parseJson(filePath);
    res.json(species);
  } catch (error) {
    console.error('Erreur lors du chargement des espèces:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des espèces' });
  }
});

// Endpoint pour récupérer les données
app.get('/api/:category', async (req, res) => {
  const { category } = req.params;
  const validCategories = ['locations', 'seeds', 'cultures', 'harvests', 'bilan'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Catégorie invalide' });
  }

  const filePath = path.join(__dirname, 'data', `${category}.json`);
  try {
    const data = await parseJson(filePath);
    res.json(data);
  } catch (error) {
    console.error(`Erreur lecture ${category}:`, error);
    res.status(500).json({ error: 'Erreur lors de la lecture des données' });
  }
});

// Endpoint pour sauvegarder les données
app.put('/api/:category', async (req, res) => {
  const { category } = req.params;
  const validCategories = ['locations', 'seeds', 'cultures', 'harvests', 'bilan'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Catégorie invalide' });
  }

  const filePath = path.join(__dirname, 'data', `${category}.json`);
  try {
    console.log(`Sauvegarde ${category}:`, JSON.stringify(req.body, null, 2));
    await writeJson(filePath, req.body);
    res.json({ message: 'Données sauvegardées' });
  } catch (error) {
    console.error(`Erreur sauvegarde ${category}:`, error);
    res.status(500).json({ error: 'Erreur lors de la sauvegarde des données' });
  }
});

// Endpoint pour supprimer une entrée
app.post('/api/:category/delete', async (req, res) => {
  const { category } = req.params;
  const { id, force } = req.body;
  const validCategories = ['locations', 'seeds', 'cultures', 'harvests', 'bilan'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Catégorie invalide' });
  }
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }

  const filePath = path.join(__dirname, 'data', `${category}.json`);
  try {
    await checkDependencies(category, id, force === true);
    const items = await parseJson(filePath);
    const itemExists = items.some(item => item.id === id);
    if (!itemExists) {
      return res.status(404).json({ error: 'Entrée non trouvée' });
    }
    const updatedItems = items.filter(item => item.id !== id);
    await writeJson(filePath, updatedItems);
    res.json({ message: 'Entrée supprimée' });
  } catch (error) {
    console.error(`Erreur suppression ${category}:`, error);
    res.status(400).json({ error: error.message });
  }
});

// Endpoint pour uploader une image
app.post('/api/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucune image fournie ou fichier invalide' });
  }
  const imagePath = `/data/pics/${req.file.filename}`;
  console.log('Image uploadée:', imagePath);
  res.json({ image: imagePath });
});

// Middleware pour les erreurs non gérées
app.use((err, req, res, next) => {
  console.error('Erreur non gérée:', err.stack);
  res.status(500).json({ error: 'Erreur serveur interne' });
});

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});
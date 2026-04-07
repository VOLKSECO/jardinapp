const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Génération d'UUID v4 compatible CommonJS
function uuidv4() {
  return crypto.randomUUID();
}

const app = express();
const port = process.env.PORT || 3001;

// Stockage des sessions en mémoire (pour production, utiliser Redis ou une DB)
const sessions = new Map();
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 heures
const SALT_ROUNDS = 10;

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
// Serve static files: if `public/` exists use it, otherwise serve project root
if (fsSync.existsSync(path.join(__dirname, 'public'))) {
  app.use(express.static('public'));
} else {
  console.warn('No public directory found — serving project root as static files.');
  app.use(express.static(path.join(__dirname)));
}
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

// ==================== AUTHENTIFICATION ====================

// Middleware pour vérifier l'authentification
function requireAuth(req, res, next) {
  const sessionId = req.headers['x-session-id'];
  
  if (!sessionId) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  
  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(401).json({ error: 'Session invalide' });
  }
  
  // Vérifier l'expiration
  if (Date.now() - session.createdAt > SESSION_DURATION) {
    sessions.delete(sessionId);
    return res.status(401).json({ error: 'Session expirée' });
  }
  
  // Ajouter l'utilisateur à la requête
  req.user = session.user;
  next();
}

// Endpoint pour vérifier si un utilisateur existe (premier lancement)
app.get('/api/auth/check-setup', async (req, res) => {
  try {
    const filePath = path.join(__dirname, 'data', 'users.json');
    const users = await parseJson(filePath);
    res.json({ hasUsers: users.length > 0 });
  } catch (error) {
    console.error('Erreur check-setup:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Endpoint pour l'inscription (UNIQUEMENT pour le premier administrateur)
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  try {
    const filePath = path.join(__dirname, 'data', 'users.json');
    const users = await parseJson(filePath);
    
    // Inscription publique désactivée si des utilisateurs existent déjà
    if (users.length > 0) {
      return res.status(403).json({ error: 'Inscription désactivée. Contactez un administrateur.' });
    }
    
    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }
    
    if (username.length < 3) {
      return res.status(400).json({ error: 'Le nom d\'utilisateur doit contenir au moins 3 caractères' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }
    
    // Validation email simple
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Email invalide' });
    }
    
    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    // Créer le premier administrateur
    const newUser = {
      id: uuidv4(),
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      role: 'admin'
    };
    
    users.push(newUser);
    await writeJson(filePath, users);
    
    // Créer une session
    const sessionId = uuidv4();
    const userWithoutPassword = { ...newUser };
    delete userWithoutPassword.password;
    
    sessions.set(sessionId, {
      user: userWithoutPassword,
      createdAt: Date.now()
    });
    
    console.log(`Premier administrateur créé: ${username}`);
    res.json({
      message: 'Inscription réussie',
      sessionId,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Erreur inscription:', error);
    res.status(500).json({ error: 'Erreur lors de l\'inscription' });
  }
});

// Endpoint pour la connexion
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
  }
  
  try {
    const filePath = path.join(__dirname, 'data', 'users.json');
    const users = await parseJson(filePath);
    
    // Trouver l'utilisateur (par username ou email)
    const user = users.find(
      u => u.username.toLowerCase() === username.toLowerCase() ||
           u.email.toLowerCase() === username.toLowerCase()
    );
    
    if (!user) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }
    
    // Vérifier le mot de passe
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }
    
    // Créer une session
    const sessionId = uuidv4();
    const userWithoutPassword = { ...user };
    delete userWithoutPassword.password;
    
    sessions.set(sessionId, {
      user: userWithoutPassword,
      createdAt: Date.now()
    });
    
    console.log(`Connexion réussie: ${username}`);
    res.json({
      message: 'Connexion réussie',
      sessionId,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Erreur connexion:', error);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

// Endpoint pour la déconnexion
app.post('/api/auth/logout', (req, res) => {
  const sessionId = req.headers['x-session-id'];
  
  if (sessionId) {
    sessions.delete(sessionId);
    console.log('Déconnexion effectuée');
  }
  
  res.json({ message: 'Déconnexion réussie' });
});

// Endpoint pour vérifier la session
app.get('/api/auth/session', (req, res) => {
  const sessionId = req.headers['x-session-id'];
  
  if (!sessionId) {
    return res.json({ authenticated: false });
  }
  
  const session = sessions.get(sessionId);
  if (!session || Date.now() - session.createdAt > SESSION_DURATION) {
    if (session) sessions.delete(sessionId);
    return res.json({ authenticated: false });
  }
  
  res.json({
    authenticated: true,
    user: session.user
  });
});

// Endpoint pour changer le mot de passe
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Les deux mots de passe sont requis' });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' });
  }
  
  try {
    const filePath = path.join(__dirname, 'data', 'users.json');
    const users = await parseJson(filePath);
    
    const userIndex = users.findIndex(u => u.id === req.user.id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Vérifier l'ancien mot de passe
    const isValid = await bcrypt.compare(currentPassword, users[userIndex].password);
    if (!isValid) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }
    
    // Mettre à jour le mot de passe
    users[userIndex].password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    users[userIndex].updatedAt = new Date().toISOString();
    await writeJson(filePath, users);
    
    console.log(`Mot de passe modifié pour: ${req.user.username}`);
    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    console.error('Erreur changement mot de passe:', error);
    res.status(500).json({ error: 'Erreur lors du changement de mot de passe' });
  }
});

// ==================== GESTION UTILISATEURS (ADMIN) ====================

// Middleware d'authentification optionnel (récupère l'utilisateur si connecté)
function optionalAuth(req, res, next) {
  const sessionId = req.headers['x-session-id'];
  if (sessionId) {
    const session = sessions.get(sessionId);
    if (session && Date.now() - session.createdAt <= SESSION_DURATION) {
      req.user = session.user;
    }
  }
  next();
}

// Endpoint pour lister les utilisateurs (admin seulement)
app.get('/api/admin/users', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  
  try {
    const filePath = path.join(__dirname, 'data', 'users.json');
    const users = await parseJson(filePath);
    // Ne pas renvoyer les mots de passe
    const safeUsers = users.map(u => {
      const { password, ...safe } = u;
      return safe;
    });
    res.json(safeUsers);
  } catch (error) {
    console.error('Erreur liste utilisateurs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Endpoint pour créer un utilisateur (admin seulement)
app.post('/api/admin/users', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  
  const { username, email, password, role = 'user' } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }
  
  if (username.length < 3) {
    return res.status(400).json({ error: 'Nom d\'utilisateur trop court (min 3 caractères)' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Mot de passe trop court (min 6 caractères)' });
  }
  
  try {
    const filePath = path.join(__dirname, 'data', 'users.json');
    const users = await parseJson(filePath);
    
    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ error: 'Ce nom d\'utilisateur existe déjà' });
    }
    
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }
    
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    const newUser = {
      id: uuidv4(),
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      role: ['admin', 'user'].includes(role) ? role : 'user'
    };
    
    users.push(newUser);
    await writeJson(filePath, users);
    
    const { password: _, ...safeUser } = newUser;
    console.log(`Utilisateur créé par admin: ${username}`);
    res.json({ message: 'Utilisateur créé', user: safeUser });
  } catch (error) {
    console.error('Erreur création utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Endpoint pour supprimer un utilisateur (admin seulement)
app.delete('/api/admin/users/:userId', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  
  const { userId } = req.params;
  
  if (userId === req.user.id) {
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
  }
  
  try {
    const filePath = path.join(__dirname, 'data', 'users.json');
    const users = await parseJson(filePath);
    
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    const deletedUser = users[userIndex];
    users.splice(userIndex, 1);
    await writeJson(filePath, users);
    
    console.log(`Utilisateur supprimé: ${deletedUser.username}`);
    res.json({ message: 'Utilisateur supprimé' });
  } catch (error) {
    console.error('Erreur suppression utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== API DONNÉES (MULTI-UTILISATEUR) ====================

// Endpoint pour récupérer les espèces (partagé entre tous)
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

// Endpoint pour récupérer les données (partagées entre tous les utilisateurs)
app.get('/api/:category', requireAuth, async (req, res) => {
  const { category } = req.params;
  const validCategories = ['locations', 'seeds', 'cultures', 'harvests', 'bilan'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Catégorie invalide' });
  }

  const filePath = path.join(__dirname, 'data', `${category}.json`);
  try {
    const allData = await parseJson(filePath);
    res.json(allData);
  } catch (error) {
    console.error(`Erreur lecture ${category}:`, error);
    res.status(500).json({ error: 'Erreur lors de la lecture des données' });
  }
});

// Endpoint pour sauvegarder les données (partagées entre tous les utilisateurs)
app.put('/api/:category', requireAuth, async (req, res) => {
  const { category } = req.params;
  const validCategories = ['locations', 'seeds', 'cultures', 'harvests', 'bilan'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Catégorie invalide' });
  }

  const filePath = path.join(__dirname, 'data', `${category}.json`);
  try {
    await writeJson(filePath, req.body);
    res.json({ message: 'Données sauvegardées' });
  } catch (error) {
    console.error(`Erreur sauvegarde ${category}:`, error);
    res.status(500).json({ error: 'Erreur lors de la sauvegarde des données' });
  }
});

// Endpoint pour supprimer une entrée
app.post('/api/:category/delete', requireAuth, async (req, res) => {
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
    
    const item = items.find(i => i.id === id);
    if (!item) {
      return res.status(404).json({ error: 'Entrée non trouvée' });
    }
    
    const updatedItems = items.filter(i => i.id !== id);
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
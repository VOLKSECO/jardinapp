// Fonction pour échapper les caractères HTML
// Paramètres : str (chaîne de caractères)
// Retour : chaîne échappée
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, match => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[match]));
}

// Fonction pour vérifier si une valeur est un nombre valide
// Paramètres : value (chaîne ou nombre)
// Retour : booléen
function isValidNumber(value) {
  return !isNaN(parseFloat(value)) && isFinite(value);
}

// Fonction utilitaire pour effectuer des requêtes fetch avec gestion d'erreurs
// Paramètres : url (chaîne), options (objet de configuration fetch)
// Retour : promesse avec les données JSON
async function fetchAPI(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Erreur HTTP ${response.status}: ${text}`);
    }
    return response.json();
  } catch (error) {
    console.error(`Erreur fetchAPI ${url}:`, error);
    throw error;
  }
}

// Fonction pour basculer entre thème clair et sombre
// Paramètres : aucun
// Retour : aucun
function toggleTheme() {
  const body = document.body;
  if (body.classList.contains('light')) {
    body.classList.remove('light');
    body.classList.add('dark');
  } else {
    body.classList.remove('dark');
    body.classList.add('light');
  }
}
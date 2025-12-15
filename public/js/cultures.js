// cultures.js
// Variables globales pour le filtrage
let activeCultureSeed = '';
let activeCultureCategory = '';
let activeCultureHarvestMonth = '';
let activeCultureAddress = '';

// Fonction pour ajouter un zéro devant les nombres < 10
function padZero(num) {
  return String(num).padStart(2, '0');
}

// Fonction pour obtenir l'image par défaut
function getDefaultCultureImage() {
  return '/data/icons/seed.png';
}

// Fonction pour vérifier si l'image est par défaut
function isDefaultCultureImage(image) {
  return !image || image === getDefaultCultureImage();
}

// Fonction pour obtenir l'image initiale pour une culture
function getInitialCultureImage(culture, seed) {
  if (culture && culture.Image) {
    return culture.Image; // Mode édition : utiliser l'image de la culture
  }
  if (seed && seed.Image && !isDefaultCultureImage(seed.Image)) {
    return seed.Image; // Nouvelle culture : utiliser l'image de la plante si personnalisée
  }
  return getDefaultCultureImage(); // Retourner l'image par défaut sinon
}

// Traduction des mois anglais vers français
const monthTranslations = {
  'january': 'janvier',
  'february': 'février',
  'march': 'mars',
  'april': 'avril',
  'may': 'mai',
  'june': 'juin',
  'july': 'juillet',
  'august': 'août',
  'september': 'septembre',
  'october': 'octobre',
  'november': 'novembre',
  'december': 'décembre'
};

// Fonction pour normaliser les mois de seeds.json
function normalizeMonth(month) {
  if (!month) return null;
  const monthLower = month.toLowerCase();
  return monthTranslations[monthLower] || monthLower;
}

// Fonction pour extraire la durée moyenne de TempsPourRécolte
function parseHarvestTime(tempsPourRécolte) {
  if (!tempsPourRécolte) return null;
  const [min, max] = tempsPourRécolte.split('-').map(Number);
  if (isNaN(min) || isNaN(max)) return null;
  return (min + max) / 2;
}

// Fonction pour calculer le mois de première récolte
function calculateHarvestMonth(plantingDate, seed) {
  if (!plantingDate || !seed || !seed.TempsPourRécolte) return null;
  const harvestTime = parseHarvestTime(seed.TempsPourRécolte);
  if (!harvestTime) return null;
  const date = new Date(plantingDate);
  date.setDate(date.getDate() + Math.round(harvestTime * 7));
  return date.toLocaleString('fr-FR', { month: 'long' }).toLowerCase();
}

// Fonction pour vérifier si la culture est proche de la récolte
function checkHarvestProximity(culture, seeds) {
  const seed = seeds.find(s => s.id === culture.Plante);
  if (!seed || !seed.TempsPourRécolte) return '';
  const weeksToHarvest = parseHarvestTime(seed.TempsPourRécolte);
  if (!weeksToHarvest) return '';
  const ageDays = calculateCultureAge(culture['Date de mise en terre']);
  const ageWeeks = ageDays / 7;
  if (ageWeeks >= weeksToHarvest * 0.9) {
    return getTranslation('warnings.harvest_proximity');
  }
  return '';
}

// Fonction pour valider la date de plantation
function validatePlantingDate(plantingDate, seed) {
  if (!plantingDate || !seed || !seed.DatesSemis) {
    console.log(`Validation date: plantingDate=${plantingDate}, seed=${seed?.NomCommun}, DatesSemis=${seed?.DatesSemis}, résultat=true`);
    return true;
  }
  const plantingMonth = new Date(plantingDate).toLocaleString('fr-FR', { month: 'long' }).toLowerCase();
  const sowingMonths = seed.DatesSemis.split(', ').map(m => normalizeMonth(m.trim())).filter(m => m);
  console.log(`Validation date: plantingDate=${plantingDate}, plantingMonth=${plantingMonth}, sowingMonths=${sowingMonths}, résultat=${sowingMonths.length === 0 || sowingMonths.includes(plantingMonth)}`);
  return sowingMonths.length === 0 || sowingMonths.includes(plantingMonth);
}

// Fonction pour vérifier si une valeur est un nombre valide
function isValidNumber(value) {
  return !isNaN(parseFloat(value)) && isFinite(value);
}

// Fonction pour vérifier si une valeur est un entier
function isInteger(value) {
  return Number.isInteger(parseFloat(value));
}

// Fonction pour calculer l'âge d'une culture en jours
function calculateCultureAge(plantingDate) {
  if (!plantingDate) return 0;
  const plantingDateObj = new Date(plantingDate);
  const today = new Date();
  const diffTime = Math.abs(today - plantingDateObj);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Fonction pour charger les cultures depuis l'API
async function loadCultures() {
  try {
    const cultures = await fetchAPI('/api/cultures');
    console.log('Cultures chargées:', cultures.length);
    return Array.isArray(cultures) ? cultures : [];
  } catch (error) {
    console.error('Erreur lors du chargement des cultures:', error);
    return [];
  }
}

// Fonction pour charger les lieux depuis l'API
async function loadLocations() {
  try {
    const locations = await fetchAPI('/api/locations');
    return Array.isArray(locations) ? locations : [];
  } catch (error) {
    console.error('Erreur lors du chargement des lieux:', error);
    return [];
  }
}

// Fonction pour charger les graines depuis l'API
async function loadSeeds() {
  try {
    const seeds = await fetchAPI('/api/seeds');
    return Array.isArray(seeds) ? seeds : [];
  } catch (error) {
    console.error('Erreur lors du chargement des graines:', error);
    return [];
  }
}

// Fonction pour sauvegarder les cultures
async function saveCultures(cultures) {
  try {
    await fetchAPI('/api/cultures', {
      method: 'PUT',
      body: JSON.stringify(cultures)
    });
    console.log('Cultures sauvegardées:', cultures.length);
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des cultures:', error);
    throw error;
  }
}

// Fonction pour supprimer une culture
async function deleteCulture(cultureId) {
  if (!cultureId) {
    throw new Error(getTranslation('errors.invalid_id'));
  }
  try {
    await fetchAPI('/api/cultures/delete', {
      method: 'POST',
      body: JSON.stringify({ id: cultureId })
    });
    console.log(`Culture ${cultureId} supprimée`);
  } catch (error) {
    console.error(`Erreur lors de la suppression de la culture ${cultureId}:`, error);
    if (error.message.includes('utilisée dans une récolte')) {
      throw new Error(getTranslation('errors.culture_in_use'));
    }
    throw new Error(getTranslation('errors.delete_failed'));
  }
}

// Fonction pour formater la date au format AAAAMMJJ
function formatDateForName(date) {
  const d = new Date(date);
  return `${d.getFullYear()}${padZero(d.getMonth() + 1)}${padZero(d.getDate())}`;
}

// Fonction pour générer le nom automatique
function generateAutoName(plantName, quantity, plantingDate) {
  
  if (!plantName || !quantity || !plantingDate) {
    return '';
  }
  const formattedDate = formatDateForName(plantingDate);
  const result = `Culture-${plantName}-${formattedDate}`;
  return result;
}

// Fonction pour afficher la modale d'ajout/modification d'une culture
async function showCultureModal(culture = null, locations = [], seeds = []) {
  if (document.querySelector('.modal')) {
    console.log('Modale déjà ouverte, annulation');
    return;
  }

  const isEdit = !!culture;
  const initialDate = new Date();
  const initialDateString = `${initialDate.getFullYear()}-${padZero(initialDate.getMonth() + 1)}-${padZero(initialDate.getDate())}`;

  if (!locations.length) locations = await loadLocations();
  if (!seeds.length) seeds = await loadSeeds();

  // Préparer les catégories
  const categories = [...new Set(seeds.map(seed => seed.Categorie).filter(cat => cat))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );

  // Déterminer l'image initiale
  const selectedSeed = culture ? seeds.find(s => s.id === culture.Plante) : null;
  const initialImage = getInitialCultureImage(culture, selectedSeed);

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close">&times;</span>
      <img id="modal-image" src="${escapeHTML(initialImage)}" alt="${getTranslation('fields.culture_image')}" style="display: block; margin: 0 auto 20px; max-width: 100%; height: 150px; object-fit: cover; cursor: pointer;" title="${getTranslation('tooltips.change_image')}">
      <form id="culture-form">
        <select id="category">
          <option value="" data-i18n="placeholders.select_category">${getTranslation('placeholders.select_category')}</option>
          ${categories.map(cat => `
            <option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>
          `).join('')}
        </select>
        <select id="plant" required>
          <option value="" data-i18n="placeholders.select_plant">${getTranslation('placeholders.select_plant')}</option>
          ${seeds
            .sort((a, b) => a.NomCommun.localeCompare(b.NomCommun, undefined, { sensitivity: 'base' }))
            .map(seed => `
              <option value="${escapeHTML(seed.id)}" data-category="${escapeHTML(seed.Categorie || '')}" ${culture && culture.Plante === seed.id ? 'selected' : ''}>
                ${escapeHTML(seed.NomCommun)}
              </option>
            `).join('')}
        </select>
<select id="location" required>
  <option value="" data-i18n="placeholders.select_location">
    ${getTranslation('placeholders.select_location')}
  </option>
  ${locations.map(loc => `
    <option value="${escapeHTML(loc.id)}" ${culture && culture.Lieu === loc.id ? 'selected' : ''}>
      ${escapeHTML(loc.Nom)}${loc.Adresse ? `, ${escapeHTML(loc.Adresse)}` : ''}
    </option>
  `).join('')}
</select>

        <input type="date" id="planting-date" value="${culture && culture['Date de mise en terre'] ? escapeHTML(culture['Date de mise en terre']) : initialDateString}" required>
        <input type="number" id="quantity" min="1" value="${culture && culture.Quantité ? escapeHTML(culture.Quantité.toString()) : ''}" placeholder="${getTranslation('placeholders.quantity')}" required>
        <input type="text" id="name" value="${culture && culture.Nom ? escapeHTML(culture.Nom) : ''}" placeholder="${getTranslation('placeholders.name')}" required>
        <select id="first-harvest-time">
          <option value="" data-i18n="placeholders.select_first_harvest_time">${getTranslation('placeholders.select_first_harvest_time')}</option>
          ${Array.from({ length: 200 }, (_, i) => i + 1).map(i => `
            <option value="${i}" ${culture && culture['Temps pour première récolte'] === i ? 'selected' : ''}>
              ${i} ${getTranslation('units.weeks')}
            </option>
          `).join('')}
        </select>
        <select id="harvest-periodicity">
          <option value="" data-i18n="placeholders.select_harvest_periodicity">${getTranslation('placeholders.select_harvest_periodicity')}</option>
          ${Array.from({ length: 200 }, (_, i) => i + 1).map(i => `
            <option value="${i}" ${culture && culture['Périodicité des récoltes'] === i ? 'selected' : ''}>
              ${i} ${getTranslation('units.weeks')}
            </option>
          `).join('')}
        </select>
        <div class="harvest-quantity-group inline-group">
          <input type="number" id="harvest-quantity" class="inline-input" min="0" step="any" value="${culture && culture['Quantité estimée par récolte'] ? escapeHTML(culture['Quantité estimée par récolte'].toString()) : ''}" placeholder="${getTranslation('placeholders.harvest_quantity')}" required>
          <select id="harvest-unit" class="inline-select" required>
            <option value="kg" ${culture && culture['Unité de récolte'] === 'kg' ? 'selected' : ''} data-i18n="units.kg">${getTranslation('units.kg')}</option>
            <option value="pieces" ${culture && culture['Unité de récolte'] === 'pieces' ? 'selected' : ''} data-i18n="units.pieces">${getTranslation('units.pieces')}</option>
          </select>
        </div>
        <select id="harvest-count" required>
          <option value="" data-i18n="placeholders.select_harvest_count">${getTranslation('placeholders.select_harvest_count')}</option>
          ${Array.from({ length: 50 }, (_, i) => i + 1).map(i => `
            <option value="${i}" ${culture && culture['Nombre de récoltes prévues'] === i ? 'selected' : ''}>
              ${i}
            </option>
          `).join('')}
        </select>
        <p id="total-quantity">${culture && culture['Quantité estimée par récolte'] && culture['Nombre de récoltes prévues'] ? escapeHTML((culture['Quantité estimée par récolte'] * culture['Nombre de récoltes prévues']).toFixed(2)) + ' ' + getTranslation(`units.${culture['Unité de récolte'] || 'kg'}`) : ''}</p>
        <textarea id="remarks" rows="4" placeholder="${getTranslation('placeholders.remarks')}">${culture && culture.Remarques ? escapeHTML(culture.Remarques || '') : ''}</textarea>
        <input type="file" id="image-input" accept="image/*" style="display: none;">
        <button type="submit" data-i18n="buttons.save">${getTranslation('buttons.save')}</button>
        ${isEdit ? `<button type="button" class="delete-btn" data-id="${escapeHTML(culture.id || '')}" data-i18n="buttons.delete">${getTranslation('buttons.delete')}</button>` : ''}
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  modal.style.display = 'flex';

  // Gestionnaire de fermeture
  modal.querySelector('.close').addEventListener('click', () => modal.remove());

  // Gestionnaire pour mettre à jour l'image
  const imageInput = modal.querySelector('#image-input');
  const modalImage = modal.querySelector('#modal-image');
  let hasCustomImage = isEdit && culture && !isDefaultCultureImage(culture.Image);

  modalImage.addEventListener('click', () => imageInput.click());

  imageInput.addEventListener('change', () => {
    if (imageInput.files[0]) {
      hasCustomImage = true;
      const reader = new FileReader();
      reader.onload = e => {
        modalImage.src = e.target.result;
        console.log('Image personnalisée chargée localement');
      };
      reader.readAsDataURL(imageInput.files[0]);
    }
  });

  // Gestion du filtrage des plantes par catégorie
  const categorySelect = modal.querySelector('#category');
  const plantSelect = modal.querySelector('#plant');
  const updatePlantOptions = (preservePlantValue = null) => {
    const selectedCategory = categorySelect.value;
    console.log(`updatePlantOptions: selectedCategory=${selectedCategory}, preservePlantValue=${preservePlantValue}`);
    const options = seeds
      .filter(seed => !selectedCategory || seed.Categorie === selectedCategory)
      .sort((a, b) => a.NomCommun.localeCompare(b.NomCommun, undefined, { sensitivity: 'base' }))
      .map(seed => `
        <option value="${escapeHTML(seed.id)}" data-category="${escapeHTML(seed.Categorie || '')}">
          ${escapeHTML(seed.NomCommun)}
        </option>
      `).join('');
    plantSelect.innerHTML = `<option value="" data-i18n="placeholders.select_plant">${getTranslation('placeholders.select_plant')}</option>${options}`;
    if (preservePlantValue && seeds.some(seed => seed.id === preservePlantValue)) {
      plantSelect.value = preservePlantValue;
      console.log(`Plante préservée: ${preservePlantValue}`);
    } else if (isEdit && culture && culture.Plante) {
      plantSelect.value = culture.Plante;
      console.log(`Plante restaurée pour édition: ${culture.Plante}`);
    }
  };

  categorySelect.addEventListener('change', () => {
    const currentPlantValue = plantSelect.value;
    updatePlantOptions(currentPlantValue);
    updateAutoName();
  });

  if (isEdit && culture && culture.Plante) {
    const seed = seeds.find(s => s.id === culture.Plante);
    if (seed && seed.Categorie) {
      categorySelect.value = seed.Categorie;
      updatePlantOptions(culture.Plante);
    }
  }

  // Mettre à jour la catégorie et l'image lors de la sélection d'une plante
  plantSelect.addEventListener('change', () => {
    const selectedSeedId = plantSelect.value;
    console.log(`plantSelect change: selectedSeedId=${selectedSeedId}`);
    const seed = seeds.find(s => s.id === selectedSeedId);
    if (seed && seed.Categorie && !categorySelect.value) {
      categorySelect.value = seed.Categorie;
      updatePlantOptions(selectedSeedId);
    }
    // Mettre à jour l'image si aucune image personnalisée n'a été chargée
    if (!hasCustomImage && seed) {
      const newImage = getInitialCultureImage(null, seed);
      modalImage.src = escapeHTML(newImage);
      console.log(`Image mise à jour pour la plante: ${newImage}`);
    }
    updateAutoName();
  });

  // Gestion du nom automatique
  const quantityInput = modal.querySelector('#quantity');
  const plantingDateInput = modal.querySelector('#planting-date');
  const nameInput = modal.querySelector('#name');
  const updateAutoName = () => {
    const quantity = quantityInput.value;
    const plantingDate = plantingDateInput.value;
    const selectedSeedId = plantSelect.value;
    const seed = seeds.find(s => s.id === selectedSeedId);
    console.log(`updateAutoName: quantity=${quantity}, plantingDate=${plantingDate}, selectedSeedId=${selectedSeedId}, seed=${seed?.NomCommun}, userModified=${nameInput.dataset.userModified}`);
    if (quantity && plantingDate && seed && !nameInput.dataset.userModified) {
      const autoName = generateAutoName(seed.NomCommun, quantity, plantingDate);
      nameInput.value = autoName;
      console.log(`Nom automatique défini: ${autoName}`);
    }
  };

  quantityInput.addEventListener('input', updateAutoName);
  plantingDateInput.addEventListener('change', updateAutoName);
  plantSelect.addEventListener('change', updateAutoName);
  nameInput.addEventListener('input', () => {
    nameInput.dataset.userModified = 'true';
    console.log('Nom modifié manuellement');
  });

  // Gestion de la quantité par récolte selon l'unité
  const harvestUnitSelect = modal.querySelector('#harvest-unit');
  const harvestQuantityInput = modal.querySelector('#harvest-quantity');
  const updateHarvestQuantityStep = () => {
    harvestQuantityInput.step = harvestUnitSelect.value === 'pieces' ? '1' : '0.01';
    if (harvestUnitSelect.value === 'pieces' && harvestQuantityInput.value) {
      harvestQuantityInput.value = Math.floor(parseFloat(harvestQuantityInput.value));
    }
  };

  harvestUnitSelect.addEventListener('change', updateHarvestQuantityStep);
  if (isEdit && culture && culture['Unité de récolte']) {
    updateHarvestQuantityStep();
  }

  // Gestion de la quantité totale
  const harvestCountSelect = modal.querySelector('#harvest-count');
  const totalQuantityDisplay = modal.querySelector('#total-quantity');
  const updateTotalQuantity = () => {
    const harvestQuantity = parseFloat(harvestQuantityInput.value) || 0;
    const harvestCount = parseInt(harvestCountSelect.value) || 0;
    const unit = harvestUnitSelect.value || 'kg';
    if (harvestQuantity && harvestCount) {
      totalQuantityDisplay.textContent = `${(harvestQuantity * harvestCount).toFixed(unit === 'pieces' ? 0 : 2)} ${getTranslation(`units.${unit}`)}`;
    } else {
      totalQuantityDisplay.textContent = '';
    }
  };

  harvestQuantityInput.addEventListener('input', updateTotalQuantity);
  harvestCountSelect.addEventListener('change', updateTotalQuantity);
  harvestUnitSelect.addEventListener('change', updateTotalQuantity);
  if (isEdit && culture && culture['Quantité estimée par récolte'] && culture['Nombre de récoltes prévues']) {
    updateTotalQuantity();
  }

  // Gestionnaire de soumission
  modal.querySelector('#culture-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const location = modal.querySelector('#location').value;
    const plant = plantSelect.value;
    const quantity = quantityInput.value.trim();
    const plantingDate = plantingDateInput.value;
    const firstHarvestTime = modal.querySelector('#first-harvest-time').value;
    const harvestPeriodicity = modal.querySelector('#harvest-periodicity').value;
    const harvestQuantity = harvestQuantityInput.value.trim();
    const harvestUnit = harvestUnitSelect.value;
    const harvestCount = harvestCountSelect.value;
    const remarks = modal.querySelector('#remarks').value.trim();
    const imageFile = imageInput.files[0];
    let imagePath;

    // Déterminer l'image à sauvegarder
    const seed = seeds.find(s => s.id === plant);
    if (imageFile) {
      // Image personnalisée uploadée
      const formData = new FormData();
      formData.append('image', imageFile);
      const response = await fetch('/api/upload-image', { method: 'POST', body: formData });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Erreur HTTP ${response.status}: ${text}`);
      }
      const result = await response.json();
      imagePath = result.image;
      hasCustomImage = true;
      console.log(`Image personnalisée uploadée: ${imagePath}`);
    } else if (isEdit && culture.Image) {
      // Conserver l'image existante en mode édition
      imagePath = culture.Image;
      console.log(`Image existante conservée: ${imagePath}`);
    } else if (seed && seed.Image && !isDefaultCultureImage(seed.Image)) {
      // Utiliser l'image de la plante si disponible
      imagePath = seed.Image;
      console.log(`Image de la plante utilisée: ${imagePath}`);
    } else {
      // Image par défaut
      imagePath = getDefaultCultureImage();
      console.log(`Image par défaut utilisée: ${imagePath}`);
    }

    // Validation des champs obligatoires
    if (!name || !location || !plant || !quantity || !plantingDate || !harvestUnit || !harvestCount) {
      alert(getTranslation('errors.required'));
      return;
    }

    // Validation des nombres
    if (!isValidNumber(quantity) || quantity < 1 || !isInteger(quantity)) {
      alert(getTranslation('errors.invalid_quantity'));
      return;
    }
    if (firstHarvestTime && (!isValidNumber(firstHarvestTime) || firstHarvestTime < 1)) {
      alert(getTranslation('errors.invalid_first_harvest_time'));
      return;
    }
    if (harvestPeriodicity && (!isValidNumber(harvestPeriodicity) || harvestPeriodicity < 1)) {
      alert(getTranslation('errors.invalid_harvest_periodicity'));
      return;
    }
    if (!isValidNumber(harvestQuantity) || harvestQuantity < 0) {
      alert(getTranslation('errors.invalid_harvest_quantity'));
      return;
    }
    if (harvestUnit === 'pieces' && !isInteger(harvestQuantity)) {
      alert(getTranslation('errors.invalid_harvest_quantity_integer'));
      return;
    }
    if (!isValidNumber(harvestCount) || harvestCount < 1) {
      alert(getTranslation('errors.invalid_harvest_count'));
      return;
    }

    // Validation de la date de plantation (log uniquement)
    if (seed && !validatePlantingDate(plantingDate, seed)) {
      console.log(`Date de mise en terre (${plantingDate}) hors des mois recommandés (${seed.DatesSemis}), mais création autorisée`);
    }

    try {
      const cultures = await loadCultures();
      const newCulture = {
        id: isEdit ? culture.id : `culture_${Date.now()}`,
        Nom: name,
        Lieu: location,
        Plante: plant,
        Quantité: parseInt(quantity, 10),
        'Date de mise en terre': plantingDate,
        'Temps pour première récolte': firstHarvestTime ? parseInt(firstHarvestTime, 10) : undefined,
        'Périodicité des récoltes': harvestPeriodicity ? parseInt(harvestPeriodicity, 10) : undefined,
        'Quantité estimée par récolte': parseFloat(harvestQuantity),
        'Unité de récolte': harvestUnit,
        'Nombre de récoltes prévues': parseInt(harvestCount, 10),
        Remarques: remarks || undefined,
        Image: imagePath
      };

      if (isEdit) {
        const index = cultures.findIndex(c => c.id === culture.id);
        if (index === -1) {
          throw new Error(getTranslation('errors.not_found'));
        }
        cultures[index] = newCulture;
      } else {
        cultures.push(newCulture);
      }

      await saveCultures(cultures);
      modal.remove();
      document.dispatchEvent(new Event('culturesUpdated'));
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
      alert(getTranslation('errors.save_failed') + ': ' + error.message);
    }
  });

  // Gestionnaire de suppression
  if (isEdit) {
    modal.querySelector('.delete-btn').addEventListener('click', async () => {
      if (confirm(getTranslation('warnings.delete_culture'))) {
        try {
          await deleteCulture(culture.id);
          modal.remove();
          document.dispatchEvent(new Event('culturesUpdated'));
        } catch (error) {
          console.error('Erreur lors de la suppression:', error);
          if (error.message === getTranslation('errors.culture_in_use')) {
            if (confirm(getTranslation('warnings.force_delete_culture'))) {
              try {
                await fetchAPI('/api/cultures/delete', {
                  method: 'POST',
                  body: JSON.stringify({ id: culture.id, force: true })
                });
                modal.remove();
                document.dispatchEvent(new Event('culturesUpdated'));
              } catch (forceError) {
                console.error('Erreur lors de la suppression forcée:', forceError);
                alert(getTranslation('errors.delete_failed'));
              }
            }
          } else {
            alert(getTranslation('errors.delete_failed') + ': ' + error.message);
          }
        }
      }
    });
  }
}

// Fonction pour rendre les vCards des cultures
async function renderCultures(cultures) {
  const container = document.getElementById('card-grid');
  const toolsContainer = document.getElementById('tools-container');
  if (!container || !toolsContainer) {
    console.error('Conteneurs #card-grid ou #tools-container manquants');
    return;
  }

  const [locations, seeds] = await Promise.all([loadLocations(), loadSeeds()]);

  // Préparer les options pour les filtres
  const usedSeedIds = [...new Set(cultures.map(c => c.Plante).filter(id => id))];
  const usedSeeds = seeds
    .filter(seed => usedSeedIds.includes(seed.id))
    .sort((a, b) => a.NomCommun.localeCompare(b.NomCommun, undefined, { sensitivity: 'base' }));

  const usedLocationIds = [...new Set(cultures.map(c => c.Lieu).filter(id => id))];
  const usedAddresses = [...new Set(
    locations
      .filter(loc => usedLocationIds.includes(loc.id))
      .map(loc => loc.Adresse)
      .filter(addr => addr)
  )].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const usedCategories = [...new Set(
    seeds
      .filter(seed => usedSeedIds.includes(seed.id))
      .map(seed => seed.Categorie)
      .filter(cat => cat)
  )].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const usedHarvestMonths = [...new Set(
    cultures
      .map(culture => {
        const seed = seeds.find(s => s.id === culture.Plante);
        return calculateHarvestMonth(culture['Date de mise en terre'], seed);
      })
      .filter(month => month)
  )].sort((a, b) => {
    const monthOrder = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    return monthOrder.indexOf(a) - monthOrder.indexOf(b);
  });

  // Générer les outils de filtrage
  toolsContainer.innerHTML = `
    <span id="culture-tools">
      <select class="filter-select seed-filter" title="${getTranslation('tooltips.filter_seed')}" aria-label="${getTranslation('tooltips.filter_seed')}">
        <option value="" data-i18n="placeholders.select_plant">${getTranslation('placeholders.select_plant')}</option>
        ${usedSeeds.map(seed => `
          <option value="${escapeHTML(seed.id)}" ${activeCultureSeed === seed.id ? 'selected' : ''}>
            ${escapeHTML(seed.NomCommun)}
          </option>
        `).join('')}
      </select>
      <select class="filter-select address-filter" title="${getTranslation('tooltips.filter_address')}" aria-label="${getTranslation('tooltips.filter_address')}">
        <option value="" data-i18n="placeholders.select_address">${getTranslation('placeholders.select_address')}</option>
        ${usedAddresses.map(addr => `
          <option value="${escapeHTML(addr)}" ${activeCultureAddress === addr ? 'selected' : ''}>
            ${escapeHTML(addr)}
          </option>
        `).join('')}
      </select>
      <select class="filter-select category-filter" title="${getTranslation('tooltips.filter_category')}" aria-label="${getTranslation('tooltips.filter_category')}">
        <option value="" data-i18n="placeholders.select_category">${getTranslation('placeholders.select_category')}</option>
        ${usedCategories.map(cat => `
          <option value="${escapeHTML(cat)}" ${activeCultureCategory === cat ? 'selected' : ''}>
            ${escapeHTML(cat)}
          </option>
        `).join('')}
      </select>
      <select class="filter-select harvest-month-filter" title="${getTranslation('tooltips.filter_harvest_month')}" aria-label="${getTranslation('tooltips.filter_harvest_month')}">
        <option value="" data-i18n="placeholders.select_harvest_month">${getTranslation('placeholders.select_harvest_month')}</option>
        ${usedHarvestMonths.map(month => `
          <option value="${escapeHTML(month)}" ${activeCultureHarvestMonth === month ? 'selected' : ''}>
            ${getTranslation(`months.${month}`)}
          </option>
        `).join('')}
      </select>
      <button class="filter-btn reset-filter" title="${getTranslation('tooltips.reset_filters')}" aria-label="${getTranslation('tooltips.reset_filters')}">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          <path d="M12 10l2 2-2 2"></path>
        </svg>
      </button>
    </span>
  `;

  // Filtrer les cultures
  const filteredCultures = cultures.filter(culture => {
    const seed = seeds.find(s => s.id === culture.Plante) || {};
    const location = locations.find(loc => loc.id === culture.Lieu) || {};
    const harvestMonth = calculateHarvestMonth(culture['Date de mise en terre'], seed);

    const matchesSeed = !activeCultureSeed || culture.Plante === activeCultureSeed;
    const matchesAddress = !activeCultureAddress || location.Adresse === activeCultureAddress;
    const matchesCategory = !activeCultureCategory || seed.Categorie === activeCultureCategory;
    const matchesHarvestMonth = !activeCultureHarvestMonth || harvestMonth === activeCultureHarvestMonth;

    return matchesSeed && matchesAddress && matchesCategory && matchesHarvestMonth;
  });

  // Trier par ordre chronologique inverse (basé sur l'id)
  const sortedCultures = filteredCultures.sort((a, b) => {
    const aTimestamp = parseInt(a.id.replace('culture_', ''), 10) || 0;
    const bTimestamp = parseInt(b.id.replace('culture_', ''), 10) || 0;
    return bTimestamp - aTimestamp;
  });

  // Nettoyer le conteneur
  container.innerHTML = '';

  // Créer la carte "Ajouter une culture"
  const addCard = document.createElement('div');
  addCard.className = 'vcard culture-card add-card';
  addCard.innerHTML = `<span data-i18n="buttons.add_culture">${getTranslation('buttons.add_culture')}</span>`;
  container.appendChild(addCard);

  // Rendre les vCards
  sortedCultures.forEach(culture => {
    const location = locations.find(loc => loc.id === culture.Lieu) || {};
    const plant = seeds.find(seed => seed.id === culture.Plante) || {};
    const harvestAlert = checkHarvestProximity(culture, seeds);
    const ageDays = calculateCultureAge(culture['Date de mise en terre']);
    const card = document.createElement('div');
    card.className = 'vcard culture-card';
    card.dataset.id = culture.id;
    card.innerHTML = `
      <div class="vcard-header">
        <span class="vcard-date small-gray">${escapeHTML(culture['Date de mise en terre'] || '-')}</span>
        <span class="vcard-age bold-black">${ageDays} ${getTranslation('units.days')}</span>
      </div>
      <div class="vcard-address small-gray">${location.Adresse ? escapeHTML(location.Adresse) : '-'}</div>
      <img src="${escapeHTML(culture.Image || getDefaultCultureImage())}" alt="${escapeHTML(culture.Nom || 'Culture')}" class="vcard-image">
      <h3 class="vcard-plant-name">${plant.NomCommun ? escapeHTML(plant.NomCommun) : escapeHTML(culture.Plante || '-')}</h3>
      <p class="vcard-total-quantity">(${
        culture['Quantité estimée par récolte'] && culture['Nombre de récoltes prévues']
          ? escapeHTML(
              (culture['Quantité estimée par récolte'] * culture['Nombre de récoltes prévues']).toFixed(
                culture['Unité de récolte'] === 'pieces' ? 0 : 2
              )
            ) +
            ' ' +
            getTranslation(`units.${culture['Unité de récolte'] === 'pieces' ? 'pieces' : 'kg'}`)
          : '-'
      })</p>
      <p class="vcard-details">${culture.Quantité ? escapeHTML(culture.Quantité.toString()) : '-'} ${getTranslation('fields.in')} ${location.Type ? escapeHTML(location.Type) : '-'}</p>
      <p class="vcard-location small-gray">${location.Nom ? escapeHTML(location.Nom) : '-'}</p>
      ${harvestAlert ? `<p class="alert">${escapeHTML(harvestAlert)}</p>` : ''}
    `;
    container.appendChild(card);
  });

  // Ajouter les gestionnaires d'événements pour les filtres
  const toolsSection = document.getElementById('culture-tools');
  toolsSection.querySelector('.seed-filter').addEventListener('change', e => {
    activeCultureSeed = e.target.value;
    document.dispatchEvent(new Event('culturesUpdated'));
  });

  toolsSection.querySelector('.address-filter').addEventListener('change', e => {
    activeCultureAddress = e.target.value;
    document.dispatchEvent(new Event('culturesUpdated'));
  });

  toolsSection.querySelector('.category-filter').addEventListener('change', e => {
    activeCultureCategory = e.target.value;
    document.dispatchEvent(new Event('culturesUpdated'));
  });

  toolsSection.querySelector('.harvest-month-filter').addEventListener('change', e => {
    activeCultureHarvestMonth = e.target.value;
    document.dispatchEvent(new Event('culturesUpdated'));
  });

  toolsSection.querySelector('.reset-filter').addEventListener('click', () => {
    activeCultureSeed = '';
    activeCultureCategory = '';
    activeCultureHarvestMonth = '';
    activeCultureAddress = '';
    toolsSection.querySelector('.seed-filter').value = '';
    toolsSection.querySelector('.address-filter').value = '';
    toolsSection.querySelector('.category-filter').value = '';
    toolsSection.querySelector('.harvest-month-filter').value = '';
    document.dispatchEvent(new Event('culturesUpdated'));
  });
}

// Initialisation de la page Cultures
function initCultures() {
  let container = document.getElementById('card-grid');
  if (container) {
    const newContainer = container.cloneNode(false);
    container.replaceWith(newContainer);
    container = newContainer;

    container.addEventListener('click', async e => {
      if (!document.querySelector('.active[data-tab="cultures"]')) return;
      e.stopPropagation();
      const card = e.target.closest('.vcard');
      if (!card) return;

      if (card.classList.contains('add-card')) {
        const locations = await loadLocations();
        const seeds = await loadSeeds();
        showCultureModal(null, locations, seeds);
      } else {
        const cultureId = card.dataset.id;
        const cultures = await loadCultures();
        const culture = cultures.find(c => c.id === cultureId);
        if (culture) {
          const locations = await loadLocations();
          const seeds = await loadSeeds();
          showCultureModal(culture, locations, seeds);
        }
      }
    });
  }

  let culturesUpdatedCount = 0;
  document.addEventListener('culturesUpdated', async () => {
    culturesUpdatedCount++;
    console.log(`culturesUpdated déclenché ${culturesUpdatedCount} fois`);
    const cultures = await loadCultures();
    if (document.querySelector('.active[data-tab="cultures"]')) {
      renderCultures(cultures);
    }
  });

  document.addEventListener('languageChanged', async () => {
    const cultures = await loadCultures();
    if (document.querySelector('.active[data-tab="cultures"]')) {
      renderCultures(cultures);
    }
  });

  console.log('Initialisation des cultures');
  document.dispatchEvent(new Event('culturesUpdated'));
}

window.initCultures = initCultures;
document.addEventListener('DOMContentLoaded', initCultures);
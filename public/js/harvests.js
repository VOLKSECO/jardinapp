// harvests.js
// Variables globales pour le filtrage
let activeHarvestCulture = '';
let activeHarvestFilterCategory = '';
let activeHarvestMonth = '';
let activeHarvestAddress = '';
let activeHarvestUnit = '';
let activeHarvestFilterType = 'culture-address';

// Fonction utilitaire pour appeler l'API
async function fetchAPI(endpoint, options = {}) {
  try {
    const response = await fetch(endpoint, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || getTranslation('errors.unknown'));
    }
    return response.json();
  } catch (error) {
    console.error(`Erreur fetchAPI ${endpoint}:`, error);
    throw error;
  }
}

// Fonction pour obtenir l'image par défaut
function getDefaultHarvestImage() {
  return '/data/icons/seed.png';
}

// Fonction pour vérifier si l'image est par défaut
function isDefaultHarvestImage(image) {
  return image === getDefaultHarvestImage();
}

// Fonction pour vérifier si une valeur est un nombre valide
function isValidNumber(num) {
  return !isNaN(parseFloat(num)) && isFinite(num);
}

// Fonction pour vérifier si une valeur est un entier
function isInteger(value) {
  return Number.isInteger(parseFloat(value));
}

// Fonction pour formater la date au format AAAAMMJJ
function formatDateForName(date) {
  const d = new Date(date);
  return `${d.getFullYear()}${padZero(d.getMonth() + 1)}${padZero(d.getDate())}`;
}

// Fonction pour générer le nom automatique
function generateAutoName(cultureName, harvestDate) {
  if (!cultureName || !harvestDate) return '';
  return `Récolte-${cultureName}-${formatDateForName(harvestDate)}`;
}

// Fonction pour extraire le mois de la date de récolte
function getHarvestMonth(harvestDate) {
  if (!harvestDate) return null;
  const date = new Date(harvestDate);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleString('fr-FR', { month: 'long' }).toLowerCase();
}

function padZero(num) {
  return (num < 10 ? '0' : '') + num;
}

// Fonction pour charger les récoltes
async function loadHarvests() {
  try {
    const harvests = await fetchAPI('/api/harvests');
    console.log('Récoltes chargées:', harvests.length);
    return Array.isArray(harvests) ? harvests : [];
  } catch (error) {
    console.error('Erreur lors du chargement des récoltes:', error);
    return [];
  }
}

// Fonction pour charger les cultures
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

// Fonction pour charger les installations
async function loadLocations() {
  try {
    const locations = await fetchAPI('/api/locations');
    console.log('Installations chargées:', locations.length);
    return Array.isArray(locations) ? locations : [];
  } catch (error) {
    console.error('Erreur lors du chargement des installations:', error);
    return [];
  }
}

// Fonction pour charger les graines
async function loadSeeds() {
  try {
    const seeds = await fetchAPI('/api/seeds');
    console.log('Graines chargées:', seeds.length);
    return Array.isArray(seeds) ? seeds : [];
  } catch (error) {
    console.error('Erreur lors du chargement des graines:', error);
    return [];
  }
}

// Fonction pour sauvegarder les récoltes
async function saveHarvests(harvests) {
  try {
    await fetchAPI('/api/harvests', {
      method: 'PUT',
      body: JSON.stringify(harvests)
    });
    console.log('Récoltes sauvegardées:', harvests.length);
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des récoltes:', error);
    throw error;
  }
}

// Fonction pour supprimer une récolte
async function deleteHarvest(harvestId) {
  if (!harvestId) throw new Error(getTranslation('errors.invalid_id'));
  try {
    await fetchAPI('/api/harvests/delete', {
      method: 'POST',
      body: JSON.stringify({ id: harvestId })
    });
    console.log(`Récolte ${harvestId} supprimée`);
  } catch (error) {
    console.error(`Erreur lors de la suppression de la récolte ${harvestId}:`, error);
    throw new Error(getTranslation('errors.delete_failed'));
  }
}

// Fonction pour afficher la modale d'ajout/modification d'une récolte
async function showModal(harvestData = null, culturesData = [], seedsData = []) {
  if (document.querySelector('.modal')) {
    console.warn('Modale déjà ouverte');
    return;
  }

  const isEdit = !!harvestData;
  const initialImage = isEdit ? (harvestData.Image || getDefaultHarvestImage()) : getDefaultHarvestImage();
  const initialDate = new Date();
  const initialDateStr = `${initialDate.getFullYear()}-${padZero(initialDate.getMonth() + 1)}-${padZero(initialDate.getDate())}`;

  if (!culturesData.length) culturesData = await loadCultures();
  if (!seedsData.length) seedsData = await loadSeeds();

  // Préparer les catégories
  const categories = [...new Set(seedsData.map(seed => seed.Categorie).filter(cat => cat))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close">&times;</span>
      <img id="modal-image" src="${escapeHTML(initialImage)}" alt="${getTranslation('fields.harvest_image')}" style="display: block; margin: 0 auto 20px; max-width: 100%; height: 150px; object-fit: cover; cursor: pointer;" title="${getTranslation('tooltips.change_image')}">
      <form id="data-form">
        <select id="category">
          <option value="" data-i18n="placeholders.select_category">${getTranslation('placeholders.select_category')}</option>
          ${categories.map(cat => `
            <option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>
          `).join('')}
        </select>
        <select id="culture" required>
          <option value="" data-i18n="placeholders.select_culture">${getTranslation('placeholders.select_culture')}</option>
          ${culturesData
            .sort((a, b) => (a.Nom || '').localeCompare(b.Nom || '', undefined, { sensitivity: 'base' }))
            .map(c => `
              <option value="${escapeHTML(c.id)}" data-category="${escapeHTML(c.Plante ? seedsData.find(s => s.id === c.Plante)?.Categorie || '' : '')}" ${isEdit && harvestData.Culture === c.id ? 'selected' : ''}>
                ${escapeHTML(c.Nom || 'N/A')}
              </option>
            `).join('')}
        </select>
        <div class="harvest-quantity-group">
          <select id="harvest-unit" required>
            <option value="kg" ${isEdit && harvestData['Unité de récolte'] === 'kg' ? 'selected' : ''} data-i18n="units.kg">${getTranslation('units.kg')}</option>
            <option value="pieces" ${isEdit && harvestData['Unité de récolte'] === 'pieces' ? 'selected' : ''} data-i18n="units.pieces">${getTranslation('units.pieces')}</option>
          </select>
          <input type="number" id="quantity" min="0" step="any" value="${isEdit && harvestData.Quantité != null ? escapeHTML(String(harvestData.Quantité)) : ''}" placeholder="${getTranslation('placeholders.quantity')}" required />
        </div>
        <input type="date" id="harvest-date" value="${isEdit && harvestData['Date de récolte'] ? escapeHTML(harvestData['Date de récolte']) : initialDateStr}" required />
        <input type="text" id="name" value="${isEdit && harvestData.Nom ? escapeHTML(harvestData.Nom) : ''}" placeholder="${getTranslation('placeholders.name')}" required />
        <textarea id="remarks" rows="4" placeholder="${getTranslation('placeholders.remarks')}">${isEdit && harvestData.Remarques ? escapeHTML(harvestData.Remarques) : ''}</textarea>
        <input type="file" id="image-input" accept="image/*" style="display: none;" />
        <button type="submit" data-i18n="buttons.save">${getTranslation('buttons.save')}</button>
        ${isEdit ? `<button type="button" class="delete-btn" data-id="${escapeHTML(harvestData.id)}" data-i18n="buttons.delete">${getTranslation('buttons.delete')}</button>` : ''}
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  modal.style.display = 'flex';

  const closeBtn = modal.querySelector('.close');
  const imageInput = modal.querySelector('#image-input');
  const modalImage = modal.querySelector('#modal-image');
  let hasCustomImage = isEdit && harvestData && !isDefaultHarvestImage(harvestData.Image);

  closeBtn.addEventListener('click', () => modal.remove());

  modalImage.addEventListener('click', () => imageInput.click());

  imageInput.addEventListener('change', () => {
    if (imageInput.files[0]) {
      hasCustomImage = true;
      const reader = new FileReader();
      reader.onload = e => modalImage.src = e.target.result;
      reader.readAsDataURL(imageInput.files[0]);
    }
  });

  // Gestion du filtrage des cultures par catégorie
  const categorySelect = modal.querySelector('#category');
  const cultureSelect = modal.querySelector('#culture');
  const updateCultureOptions = (preserveCultureValue = null) => {
    const selectedCategory = categorySelect.value;
    const options = culturesData
      .filter(culture => {
        const seed = seedsData.find(s => s.id === culture.Plante);
        return !selectedCategory || (seed && seed.Categorie === selectedCategory);
      })
      .sort((a, b) => (a.Nom || '').localeCompare(b.Nom || '', undefined, { sensitivity: 'base' }))
      .map(culture => `
        <option value="${escapeHTML(culture.id)}" data-category="${escapeHTML(seedsData.find(s => s.id === culture.Plante)?.Categorie || '')}">
          ${escapeHTML(culture.Nom || 'N/A')}
        </option>
      `).join('');
    cultureSelect.innerHTML = `<option value="" data-i18n="placeholders.select_culture">${getTranslation('placeholders.select_culture')}</option>${options}`;
    if (preserveCultureValue) {
      cultureSelect.value = preserveCultureValue;
    } else if (isEdit && harvestData && harvestData.Culture) {
      cultureSelect.value = harvestData.Culture;
    }
  };

  categorySelect.addEventListener('change', () => {
    updateCultureOptions(cultureSelect.value);
    updateAutoName();
  });

  if (isEdit && harvestData && harvestData.Culture) {
    const culture = culturesData.find(c => c.id === harvestData.Culture);
    if (culture) {
      const seed = seedsData.find(s => s.id === culture.Plante);
      if (seed && seed.Categorie) {
        categorySelect.value = seed.Categorie;
        updateCultureOptions(harvestData.Culture);
      }
    }
  }

  // Mettre à jour la catégorie lors de la sélection d'une culture
  cultureSelect.addEventListener('change', () => {
    const selectedCultureId = cultureSelect.value;
    const culture = culturesData.find(c => c.id === selectedCultureId);
    if (culture) {
      const seed = seedsData.find(s => s.id === culture.Plante);
      if (seed && seed.Categorie && !categorySelect.value) {
        categorySelect.value = seed.Categorie;
        updateCultureOptions(selectedCultureId);
      }
    }
    updateAutoName();
  });

  // Gestion du nom automatique
  const harvestDateInput = modal.querySelector('#harvest-date');
  const nameInput = modal.querySelector('#name');
  const updateAutoName = () => {
    const harvestDate = harvestDateInput.value;
    const selectedCultureId = cultureSelect.value;
    const culture = culturesData.find(c => c.id === selectedCultureId);
    if (harvestDate && culture && !nameInput.dataset.userModified) {
      nameInput.value = generateAutoName(culture.Nom, harvestDate);
    }
  };

  harvestDateInput.addEventListener('change', updateAutoName);
  cultureSelect.addEventListener('change', updateAutoName);
  nameInput.addEventListener('input', () => {
    nameInput.dataset.userModified = 'true';
  });

  // Gestion de la quantité selon l'unité
  const harvestUnitSelect = modal.querySelector('#harvest-unit');
  const quantityInput = modal.querySelector('#quantity');
  const updateHarvestQuantityStep = () => {
    quantityInput.step = harvestUnitSelect.value === 'pieces' ? '1' : '0.01';
    if (harvestUnitSelect.value === 'pieces' && quantityInput.value) {
      quantityInput.value = Math.floor(parseFloat(quantityInput.value));
    }
  };

  harvestUnitSelect.addEventListener('change', updateHarvestQuantityStep);
  if (isEdit && harvestData && harvestData['Unité de récolte']) {
    updateHarvestQuantityStep();
  }

  modal.querySelector('#data-form').addEventListener('submit', async e => {
    e.preventDefault();
    const inputs = {
      name: modal.querySelector('#name').value.trim(),
      culture: modal.querySelector('#culture').value,
      quantity: modal.querySelector('#quantity').value.trim(),
      harvestDate: modal.querySelector('#harvest-date').value,
      remarks: modal.querySelector('#remarks').value.trim(),
      unit: modal.querySelector('#harvest-unit').value,
      imageFile: modal.querySelector('#image-input').files[0]
    };

    if (!inputs.name || !inputs.culture || !inputs.quantity || !inputs.harvestDate || !inputs.unit) {
      alert(getTranslation('errors.required'));
      return;
    }

    if (!isValidNumber(inputs.quantity) || inputs.quantity < 0) {
      alert(getTranslation('errors.invalid_quantity'));
      return;
    }
    if (inputs.unit === 'pieces' && !isInteger(inputs.quantity)) {
      alert(getTranslation('errors.invalid_harvest_quantity_integer'));
      return;
    }

    try {
      let imagePath = isEdit ? (harvestData.Image || getDefaultHarvestImage()) : getDefaultHarvestImage();
      if (inputs.imageFile) {
        const formData = new FormData();
        formData.append('image', inputs.imageFile);
        const response = await fetch('/api/upload-image', { method: 'POST', body: formData });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Erreur HTTP ${response.status}: ${text}`);
        }
        const result = await response.json();
        imagePath = result.image;
        hasCustomImage = true;
      }

      const harvests = await loadHarvests();
      const newHarvest = {
        id: isEdit ? harvestData.id : `harvest_${Date.now()}`,
        Nom: inputs.name,
        Culture: inputs.culture,
        Quantité: parseFloat(inputs.quantity),
        'Date de récolte': inputs.harvestDate,
        'Unité de récolte': inputs.unit,
        Remarques: inputs.remarks || undefined,
        Image: imagePath
      };

      if (isEdit) {
        const index = harvests.findIndex(h => h.id === harvestData.id);
        if (index === -1) throw new Error(getTranslation('errors.not_found'));
        harvests[index] = newHarvest;
      } else {
        harvests.push(newHarvest);
      }

      await saveHarvests(harvests);
      modal.remove();
      document.dispatchEvent(new Event('harvestsUpdated'));
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
      alert(getTranslation('errors.save_failed') + ': ' + error.message);
    }
  });

  if (isEdit) {
    modal.querySelector('.delete-btn').addEventListener('click', async () => {
      if (confirm(getTranslation('warnings.delete_harvest'))) {
        try {
          await deleteHarvest(harvestData.id);
          modal.remove();
          document.dispatchEvent(new Event('harvestsUpdated'));
        } catch (error) {
          console.error('Erreur lors de la suppression:', error);
          alert(getTranslation('errors.delete_failed') + ': ' + error.message);
        }
      }
    });
  }
}

// Fonction pour rendre les cartes des récoltes
async function renderHarvests(harvests) {
  const container = document.getElementById('card-grid');
  const toolsContainer = document.getElementById('tools-container');
  if (!container || !toolsContainer) {
    console.error('Conteneurs #card-grid ou #tools-container manquants');
    return;
  }

  const [cultures, locations, seeds] = await Promise.all([
    loadCultures(),
    loadLocations(),
    loadSeeds()
  ]);

  const usedCultureIds = [...new Set(harvests.map(h => h.Culture).filter(id => id))];
  const usedCultures = cultures
    .filter(c => usedCultureIds.includes(c.id))
    .sort((a, b) => (a.Nom || '').localeCompare(b.Nom || '', undefined, { sensitivity: 'base' }));

  const usedLocationIds = [...new Set(cultures.map(c => c.Lieu).filter(id => id))];
  const usedAddresses = [...new Set(
    locations
      .filter(l => usedLocationIds.includes(l.id))
      .map(l => l.Adresse)
      .filter(a => a)
  )].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const usedCategories = [...new Set(
    seeds
      .filter(s => usedCultures.some(c => c.Plante === s.id))
      .map(s => s.Categorie)
      .filter(cat => cat)
  )].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const usedHarvestMonths = [...new Set(
    harvests
      .map(h => getHarvestMonth(h['Date de récolte']))
      .filter(month => month)
  )].sort((a, b) => {
    const monthOrder = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    return monthOrder.indexOf(a) - monthOrder.indexOf(b);
  });

  const usedUnits = [...new Set(harvests.map(h => h['Unité de récolte']).filter(u => u))];

  toolsContainer.innerHTML = `
    <span id="harvest-tools">
      <select class="filter-select filter-type" title="${getTranslation('tooltips.filter_type')}" aria-label="${getTranslation('tooltips.filter_type')}">
        <option value="culture-address" ${activeHarvestFilterType === 'culture-address' ? 'selected' : ''} data-i18n="filters.culture_address">${getTranslation('filters.culture_address')}</option>
        <option value="category" ${activeHarvestFilterType === 'category' ? 'selected' : ''} data-i18n="filters.category">${getTranslation('filters.category')}</option>
        <option value="harvest-month" ${activeHarvestFilterType === 'harvest-month' ? 'selected' : ''} data-i18n="filters.harvest_month">${getTranslation('filters.harvest_month')}</option>
        <option value="unit" ${activeHarvestFilterType === 'unit' ? 'selected' : ''} data-i18n="filters.unit">${getTranslation('filters.unit')}</option>
      </select>
      <span class="culture-address-filters" style="display: ${activeHarvestFilterType === 'culture-address' ? 'flex' : 'none'};">
        <select class="filter-select culture-filter" title="${getTranslation('tooltips.filter_culture')}" aria-label="${getTranslation('tooltips.filter_culture')}">
          <option value="" data-i18n="placeholders.select_culture">${getTranslation('placeholders.select_culture')}</option>
          ${usedCultures.map(c => `
            <option value="${escapeHTML(c.id)}" ${activeHarvestCulture === c.id ? 'selected' : ''}>
              ${escapeHTML(c.Nom || 'N/A')}
            </option>
          `).join('')}
        </select>
        <select class="filter-select address-filter" title="${getTranslation('tooltips.filter_address')}" aria-label="${getTranslation('tooltips.filter_address')}">
          <option value="" data-i18n="placeholders.select_address">${getTranslation('placeholders.select_address')}</option>
          ${usedAddresses.map(a => `
            <option value="${escapeHTML(a)}" ${activeHarvestAddress === a ? 'selected' : ''}>
              ${escapeHTML(a)}
            </option>
          `).join('')}
        </select>
      </span>
      <span class="category-filters" style="display: ${activeHarvestFilterType === 'category' ? 'flex' : 'none'};">
        <select class="filter-select category-filter" title="${getTranslation('tooltips.filter_category')}" aria-label="${getTranslation('tooltips.filter_category')}">
          <option value="" data-i18n="placeholders.select_category">${getTranslation('placeholders.select_category')}</option>
          ${usedCategories.map(cat => `
            <option value="${escapeHTML(cat)}" ${activeHarvestFilterCategory === cat ? 'selected' : ''}>
              ${escapeHTML(cat)}
            </option>
          `).join('')}
        </select>
      </span>
      <span class="month-filters" style="display: ${activeHarvestFilterType === 'harvest-month' ? 'flex' : 'none'};">
        <select class="filter-select month-filter" title="${getTranslation('tooltips.filter_harvest_month')}" aria-label="${getTranslation('tooltips.filter_harvest_month')}">
          <option value="" data-i18n="placeholders.select_harvest_month">${getTranslation('placeholders.select_harvest_month')}</option>
          ${usedHarvestMonths.map(month => `
            <option value="${escapeHTML(month)}" ${activeHarvestMonth === month ? 'selected' : ''}>
              ${getTranslation(`months.${month}`)}
            </option>
          `).join('')}
        </select>
      </span>
      <span class="unit-filters" style="display: ${activeHarvestFilterType === 'unit' ? 'flex' : 'none'};">
        <select class="filter-select unit-filter" title="${getTranslation('tooltips.filter_unit')}" aria-label="${getTranslation('tooltips.filter_unit')}">
          <option value="" data-i18n="placeholders.select_unit">${getTranslation('placeholders.select_unit')}</option>
          ${usedUnits.map(unit => `
            <option value="${escapeHTML(unit)}" ${activeHarvestUnit === unit ? 'selected' : ''}>
              ${getTranslation(`units.${unit}`)}
            </option>
          `).join('')}
        </select>
      </span>
      <button class="filter-btn reset-filter" title="${getTranslation('tooltips.reset_filters')}" aria-label="${getTranslation('tooltips.reset_filters')}">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          <path d="M12 10l2 2-2 2"></path>
        </svg>
      </button>
    </span>
  `;

  const filteredHarvests = harvests.filter(h => {
    const culture = cultures.find(c => c.id === h.Culture) || {};
    const seed = culture.Plante ? seeds.find(s => s.id === culture.Plante) : null;
    const location = culture.Lieu ? locations.find(l => l.id === culture.Lieu) : null;

    const matchesCulture = !activeHarvestCulture || h.Culture === activeHarvestCulture;
    const matchesCategory = !activeHarvestFilterCategory || (seed && seed.Categorie === activeHarvestFilterCategory);
    const matchesHarvestMonth = !activeHarvestMonth || getHarvestMonth(h['Date de récolte']) === activeHarvestMonth;
    const matchesAddress = !activeHarvestAddress || (location && location.Adresse === activeHarvestAddress);
    const matchesUnit = !activeHarvestUnit || h['Unité de récolte'] === activeHarvestUnit;

    return matchesCulture && matchesCategory && matchesHarvestMonth && matchesAddress && matchesUnit;
  });

  const sortedHarvests = filteredHarvests.sort((a, b) => {
    const aTimestamp = parseInt(a.id.replace('harvest_', ''), 10) || 0;
    const bTimestamp = parseInt(b.id.replace('harvest_', ''), 10) || 0;
    return bTimestamp - aTimestamp;
  });

  container.innerHTML = '';

  const addCard = document.createElement('div');
  addCard.className = 'vcard harvest-card add-card';
  addCard.innerHTML = `<span data-i18n="buttons.add_harvest">${getTranslation('buttons.add_harvest')}</span>`;
  container.appendChild(addCard);

  sortedHarvests.forEach(h => {
    const culture = cultures.find(c => c.id === h.Culture) || {};
    const seed = culture.Plante ? seeds.find(s => s.id === culture.Plante) : {};
    const location = culture.Lieu ? locations.find(l => l.id === culture.Lieu) : {};
    const card = document.createElement('div');
    card.className = 'vcard harvest-card';
    card.dataset.id = h.id;
    card.innerHTML = `
      <img src="${escapeHTML(h.Image || getDefaultHarvestImage())}" alt="${escapeHTML(h.Nom || 'Récolte')}" style="max-width: 100%; height: 100px; object-fit: cover;">
      <h3>${escapeHTML(h.Nom || 'Sans nom')}</h3>
      <p>${seed.NomCommun ? escapeHTML(seed.NomCommun) : escapeHTML(culture.Plante || 'N/A')}</p>
      <p>${escapeHTML(h['Date de récolte'] || 'N/A')}</p>
      <p>${escapeHTML(String(h.Quantité || '0'))} ${getTranslation(`units.${h['Unité de récolte'] || 'kg'}`)} ${getTranslation('fields.from')} ${culture.Nom ? escapeHTML(culture.Nom) : escapeHTML(h.Culture || 'N/A')}</p>
      <p class="address">${location.Adresse ? escapeHTML(location.Adresse) : ''}</p>
      <p>${h.Remarques ? escapeHTML(h.Remarques) : ''}</p>
    `;
    container.appendChild(card);
  });

  const tools = document.getElementById('harvest-tools');
  tools.querySelector('.filter-type').addEventListener('change', e => {
    activeHarvestFilterType = e.target.value;
    tools.querySelector('.culture-address-filters').style.display = activeHarvestFilterType === 'culture-address' ? 'flex' : 'none';
    tools.querySelector('.category-filters').style.display = activeHarvestFilterType === 'category' ? 'flex' : 'none';
    tools.querySelector('.month-filters').style.display = activeHarvestFilterType === 'harvest-month' ? 'flex' : 'none';
    tools.querySelector('.unit-filters').style.display = activeHarvestFilterType === 'unit' ? 'flex' : 'none';
    if (activeHarvestFilterType !== 'culture-address') {
      activeHarvestCulture = '';
      activeHarvestAddress = '';
    }
    if (activeHarvestFilterType !== 'category') {
      activeHarvestFilterCategory = '';
    }
    if (activeHarvestFilterType !== 'harvest-month') {
      activeHarvestMonth = '';
    }
    if (activeHarvestFilterType !== 'unit') {
      activeHarvestUnit = '';
    }
    document.dispatchEvent(new Event('harvestsUpdated'));
  });

  tools.querySelector('.culture-filter').addEventListener('change', e => {
    activeHarvestCulture = e.target.value;
    document.dispatchEvent(new Event('harvestsUpdated'));
  });

  tools.querySelector('.address-filter').addEventListener('change', e => {
    activeHarvestAddress = e.target.value;
    document.dispatchEvent(new Event('harvestsUpdated'));
  });

  tools.querySelector('.category-filter').addEventListener('change', e => {
    activeHarvestFilterCategory = e.target.value;
    document.dispatchEvent(new Event('harvestsUpdated'));
  });

  tools.querySelector('.month-filter').addEventListener('change', e => {
    activeHarvestMonth = e.target.value;
    document.dispatchEvent(new Event('harvestsUpdated'));
  });

  tools.querySelector('.unit-filter').addEventListener('change', e => {
    activeHarvestUnit = e.target.value;
    document.dispatchEvent(new Event('harvestsUpdated'));
  });

  tools.querySelector('.reset-filter').addEventListener('click', () => {
    activeHarvestFilterType = 'culture-address';
    activeHarvestCulture = '';
    activeHarvestAddress = '';
    activeHarvestFilterCategory = '';
    activeHarvestMonth = '';
    activeHarvestUnit = '';
    tools.querySelector('.filter-type').value = 'culture-address';
    tools.querySelector('.culture-filter').value = '';
    tools.querySelector('.address-filter').value = '';
    tools.querySelector('.category-filter').value = '';
    tools.querySelector('.month-filter').value = '';
    tools.querySelector('.unit-filter').value = '';
    document.dispatchEvent(new Event('harvestsUpdated'));
  });
}

// Initialisation
function initHarvests() {
  let container = document.getElementById('card-grid');
  if (container) {
    const newContainer = container.cloneNode(false);
    container.replaceWith(newContainer);
    container = newContainer;

    container.addEventListener('click', async e => {
      if (!document.querySelector('.active[data-tab="harvests"]')) return;
      e.stopPropagation();
      const card = e.target.closest('.vcard');
      if (!card) return;

      if (card.classList.contains('add-card')) {
        const [cultures, seeds] = await Promise.all([loadCultures(), loadSeeds()]);
        showModal(null, cultures, seeds);
      } else {
        const harvestId = card.dataset.id;
        const harvests = await loadHarvests();
        const harvest = harvests.find(h => h.id === harvestId);
        if (harvest) {
          const [cultures, seeds] = await Promise.all([loadCultures(), loadSeeds()]);
          showModal(harvest, cultures, seeds);
        }
      }
    });
  }

  let updateCount = 0;
  document.addEventListener('harvestsUpdated', async () => {
    updateCount++;
    console.log(`harvestsUpdated déclenché ${updateCount} fois`);
    const harvests = await loadHarvests();
    if (document.querySelector('.active[data-tab="harvests"]')) {
      renderHarvests(harvests);
    }
  });

  document.addEventListener('languageChanged', async () => {
    const harvests = await loadHarvests();
    if (document.querySelector('.active[data-tab="harvests"]')) {
      renderHarvests(harvests);
    }
  });

  console.log('Initialisation des récoltes');
  document.dispatchEvent(new Event('harvestsUpdated'));
}

window.initHarvests = initHarvests;
document.addEventListener('DOMContentLoaded', initHarvests);
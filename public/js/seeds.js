// seeds.js
// Variables globales pour le filtrage
let activeSearch = ''; // Recherche par nom commun
let activeCategory = ''; // Catégorie active
let activeType = ''; // Type actif
let activeSowingMonth = ''; // Mois de semis actif

// Fonction pour obtenir l'image par défaut pour les graines
function getDefaultSeedImage() {
  return '/data/icons/seed.png';
}

// Fonction pour vérifier si une image est l'image par défaut
function isDefaultSeedImage(imagePath) {
  return imagePath === '/data/icons/seed.png';
}

// Fonction pour charger les graines depuis l'API
async function loadSeeds() {
  try {
    const seeds = await fetchAPI('/api/seeds');
    return seeds.map(seed => ({
      ...seed,
      Image: seed.Image || getDefaultSeedImage(),
      DatesSemis: seed.DatesSemis || '',
      DatesRécolte: seed.DatesRécolte || '',
      Remarques: seed.Remarques || '',
      TempsGermination: seed.TempsGermination || '1-1',
      TempsPourRécolte: seed.TempsPourRécolte || '1-1'
    }));
  } catch (error) {
    console.error('Erreur lors du chargement des graines:', error);
    return [];
  }
}

// Fonction pour charger les espèces depuis l'API
async function loadSpecies() {
  try {
    const categories = await fetchAPI('/api/species');
    console.log('Catégories chargées:', categories);
    return Array.isArray(categories) ? categories : [];
  } catch (error) {
    console.error('Erreur lors du chargement des espèces:', error);
    return [];
  }
}

// Fonction pour sauvegarder les graines via l'API
async function saveSeeds(seeds) {
  try {
    console.log('Envoi des graines à l’API:', JSON.stringify(seeds, null, 2));
    await fetchAPI('/api/seeds', {
      method: 'PUT',
      body: JSON.stringify(seeds)
    });
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des graines:', error);
    throw error;
  }
}

// Fonction pour supprimer une graine via l'API
async function deleteSeed(id) {
  try {
    await fetchAPI('/api/seeds/delete', {
      method: 'POST',
      body: JSON.stringify({ id })
    });
  } catch (error) {
    console.error('Erreur lors de la suppression de la graine:', error);
    throw error;
  }
}

// Fonction pour générer les options de sélecteur (1 à 200)
function generateRangeOptions(selectedValue) {
  let options = '';
  for (let i = 1; i <= 200; i++) {
    options += `<option value="${i}" ${selectedValue == i ? 'selected' : ''}>${i}</option>`;
  }
  return options;
}

// Fonction pour filtrer les graines
function filterSeeds(seeds, search = '', category = '', type = '', sowingMonth = '') {
  return seeds.filter(seed => {
    const matchesSearch = !search || 
      (seed.NomCommun && seed.NomCommun.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = !category || seed.Categorie === category;
    const matchesType = !type || seed.Type === type;
    const matchesSowingMonth = !sowingMonth || 
      (seed.DatesSemis && seed.DatesSemis.split(', ').map(m => m.trim()).includes(sowingMonth));
    return matchesSearch && matchesCategory && matchesType && matchesSowingMonth;
  });
}

// Fonction pour afficher les vCards des graines
async function renderSeeds(seeds) {
  const grid = document.getElementById('card-grid');
  const toolsContainer = document.getElementById('tools-container');
  if (!grid || !toolsContainer) {
    console.error('Conteneurs #card-grid ou #tools-container manquants');
    return;
  }

  // Charger les catégories pour le filtre
  const categories = await loadSpecies();
  const usedCategories = [...new Set(categories.map(c => c.name).filter(c => c))].sort();
  const usedTypes = ['Cyclique', 'Statique'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Générer les outils de filtrage
  toolsContainer.innerHTML = `
    <span id="seed-tools">
      <input type="text" id="search-filter" value="${escapeHTML(activeSearch)}" placeholder="${getTranslation('placeholders.search')}" title="${getTranslation('tooltips.search')}" aria-label="${getTranslation('tooltips.search')}">
      <select id="category-filter" class="filter-select" title="${getTranslation('tooltips.filter_category')}" aria-label="${getTranslation('tooltips.filter_category')}">
        <option value="" ${activeCategory === '' ? 'selected' : ''}>${getTranslation('placeholders.select_category')}</option>
        ${usedCategories.map(cat => `
          <option value="${escapeHTML(cat)}" ${activeCategory === cat ? 'selected' : ''}>
            ${escapeHTML(cat)}
          </option>
        `).join('')}
      </select>
      <select id="type-filter" class="filter-select" title="${getTranslation('tooltips.filter_type')}" aria-label="${getTranslation('tooltips.filter_type')}">
        <option value="" ${activeType === '' ? 'selected' : ''}>${getTranslation('placeholders.select_type')}</option>
        ${usedTypes.map(type => `
          <option value="${escapeHTML(type)}" ${activeType === type ? 'selected' : ''}>
            ${getTranslation(`fields.${type.toLowerCase()}`)}
          </option>
        `).join('')}
      </select>
      <select id="sowing-month-filter" class="filter-select" title="${getTranslation('tooltips.filter_sowing_month')}" aria-label="${getTranslation('tooltips.filter_sowing_month')}">
        <option value="" ${activeSowingMonth === '' ? 'selected' : ''}>${getTranslation('placeholders.select_sowing_month')}</option>
        ${months.map(month => `
          <option value="${month}" ${activeSowingMonth === month ? 'selected' : ''}>
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

  // Filtrer et trier les graines
  const filteredSeeds = filterSeeds(seeds, activeSearch, activeCategory, activeType, activeSowingMonth);
  const sortedSeeds = filteredSeeds.sort((a, b) => 
    a.NomCommun.localeCompare(b.NomCommun, undefined, { sensitivity: 'base' })
  );

  // Nettoyer le contenu existant
  grid.innerHTML = '';

  // Créer la carte "Ajouter une graine"
  const addCard = document.createElement('div');
  addCard.className = 'vcard seed-card add-card';
  addCard.innerHTML = `<span>${getTranslation('buttons.add_seed')}</span>`;
  grid.appendChild(addCard);

  // Rendre les cartes des graines
  sortedSeeds.forEach(seed => {
    const card = document.createElement('div');
    card.className = 'vcard seed-card';
    card.dataset.id = escapeHTML(seed.id);
    card.innerHTML = `
      <img src="${escapeHTML(seed.Image)}" alt="${escapeHTML(seed.NomCommun)}" style="max-width: 100%; height: 100px; object-fit: cover;">
      <h3>${escapeHTML(seed.NomCommun)}</h3>
      <p class="scientific-name">${seed.NomScientifique ? escapeHTML(seed.NomScientifique) : ''}</p>
      <p>${seed.Categorie ? escapeHTML(seed.Categorie) : ''}</p>
      <p>${seed.Espèce ? escapeHTML(seed.Espèce) : ''}</p>
    `;
    grid.appendChild(card);
  });

  // Ajouter les gestionnaires d'événements pour les filtres
  const toolsSection = document.getElementById('seed-tools');
  toolsSection.querySelector('#search-filter').addEventListener('input', e => {
    activeSearch = e.target.value.trim();
    document.dispatchEvent(new Event('seedsUpdated'));
  });

  toolsSection.querySelector('#category-filter').addEventListener('change', e => {
    activeCategory = e.target.value;
    document.dispatchEvent(new Event('seedsUpdated'));
  });

  toolsSection.querySelector('#type-filter').addEventListener('change', e => {
    activeType = e.target.value;
    document.dispatchEvent(new Event('seedsUpdated'));
  });

  toolsSection.querySelector('#sowing-month-filter').addEventListener('change', e => {
    activeSowingMonth = e.target.value;
    document.dispatchEvent(new Event('seedsUpdated'));
  });

  toolsSection.querySelector('.reset-filter').addEventListener('click', () => {
    activeSearch = '';
    activeCategory = '';
    activeType = '';
    activeSowingMonth = '';
    toolsSection.querySelector('#search-filter').value = '';
    toolsSection.querySelector('#category-filter').value = '';
    toolsSection.querySelector('#type-filter').value = '';
    toolsSection.querySelector('#sowing-month-filter').value = '';
    document.dispatchEvent(new Event('seedsUpdated'));
  });
}

// Fonction pour afficher la modale d'ajout/modification d'une graine
async function showSeedModal(seed = null, categories = []) {
  document.querySelectorAll('.modal').forEach(m => m.remove());

  const isEdit = !!seed;
  const initialImage = seed ? seed.Image : getDefaultSeedImage();
  let hasCustomImage = isEdit && seed && !isDefaultSeedImage(seed.Image);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const germinationRange = seed && seed.TempsGermination ? seed.TempsGermination.split('-').map(Number) : [1, 1];
  const harvestRange = seed && seed.TempsPourRécolte ? seed.TempsPourRécolte.split('-').map(Number) : [1, 1];

  if (!categories.length) {
    categories = await loadSpecies();
    if (!categories.length) {
      console.warn('Aucune catégorie chargée, utilisation d’un sélecteur vide.');
    }
  }

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close">×</span>
     
      <img id="modal-image" src="${escapeHTML(initialImage)}" alt="${getTranslation('fields.seed_image')}" style="display: block; margin: 0 auto 20px; max-width: 100%; height: 150px; object-fit: cover; cursor: pointer;" title="${getTranslation('tooltips.change_image')}">
   
      <form id="seed-form">
   
      <input type="text" id="common-name" value="${seed ? escapeHTML(seed.NomCommun) : ''}" placeholder="${getTranslation('placeholders.common_name')}" required>
   
      <select id="category" required>
          <option value="" data-i18n="placeholders.select_category">${getTranslation('placeholders.select_category')}</option>
          ${categories.map(cat => `
            <option value="${escapeHTML(cat.name)}" ${seed && seed.Categorie === cat.name ? 'selected' : ''}>
              ${escapeHTML(cat.name)}
            </option>
          `).join('')}
        </select>

        <select id="species" required>
          <option value="" data-i18n="placeholders.select_species">${getTranslation('placeholders.select_species')}</option>
        </select>

        <select id="seed-type" required>
          <option value="" data-i18n="placeholders.select_type">${getTranslation('placeholders.select_type')}</option>
          <option value="Cyclique" data-i18n="fields.cyclique" ${seed && seed.Type === 'Cyclique' ? 'selected' : ''}>${getTranslation('fields.cyclique')}</option>
          <option value="Statique" data-i18n="fields.statique" ${seed && seed.Type === 'Statique' ? 'selected' : ''}>${getTranslation('fields.statique')}</option>
        </select>

        <!-- MOIS DE SEMIS -->
<div class="month-selection">
  <div class="month-summary" data-type="sowing" data-i18n="placeholders.select_seed_sowing_months">
    ${seed && seed.DatesSemis && seed.DatesSemis.trim() 
      ? seed.DatesSemis.split(', ').map(m => getTranslation(`months.${m.trim()}`)).join(', ') 
      : getTranslation('placeholders.select_seed_sowing_months')}
  </div>
  <div class="month-buttons" data-type="sowing" style="display: none;">
    ${months.map(month => `
      <button type="button" 
              class="month-button ${seed && seed.DatesSemis && seed.DatesSemis.split(', ').map(m => m.trim()).includes(month) ? 'selected' : ''}" 
              data-month="${month}" 
              data-i18n="months.${month}">
        ${getTranslation(`months.${month}`)}
      </button>
    `).join('')}
  </div>
</div>

<!-- MOIS DE RÉCOLTE -->
<div class="month-selection">
  <div class="month-summary" data-type="harvest" data-i18n="placeholders.select_seed_harvest_months">
    ${seed && seed.DatesRécolte && seed.DatesRécolte.trim() 
      ? seed.DatesRécolte.split(', ').map(m => getTranslation(`months.${m.trim()}`)).join(', ') 
      : getTranslation('placeholders.select_seed_harvest_months')}
  </div>
  <div class="month-buttons" data-type="harvest" style="display: none;">
    ${months.map(month => `
      <button type="button" 
              class="month-button ${seed && seed.DatesRécolte && seed.DatesRécolte.split(', ').map(m => m.trim()).includes(month) ? 'selected' : ''}" 
              data-month="${month}" 
              data-i18n="months.${month}">
        ${getTranslation(`months.${month}`)}
      </button>
    `).join('')}
  </div>
</div>

        <div class="range-selection">
          <div class="range-summary" data-type="germination" data-i18n="placeholders.select_seed_germination_time">
            ${seed && seed.TempsGermination ? `${seed.TempsGermination} ${getTranslation('units.days')}` : getTranslation('placeholders.select_seed_germination_time')}
          </div>
          <div class="range-selectors" data-type="germination" style="display: none;">
            <span data-i18n="labels.between">${getTranslation('labels.between')}</span>
            <select class="range-min" data-type="germination-min">
              ${generateRangeOptions(germinationRange[0])}
            </select>
            <span data-i18n="labels.and">${getTranslation('labels.and')}</span>
            <select class="range-max" data-type="germination-max">
              ${generateRangeOptions(germinationRange[1])}
            </select>
            <span data-i18n="units.days">${getTranslation('units.days')}</span>
          </div>
        </div>

        <div class="range-selection">
          <div class="range-summary" data-type="harvest" data-i18n="placeholders.select_seed_harvest_time">
            ${seed && seed.TempsPourRécolte ? `${seed.TempsPourRécolte} ${getTranslation('units.weeks')}` : getTranslation('placeholders.select_seed_harvest_time')}
          </div>
          <div class="range-selectors" data-type="harvest" style="display: none;">
            <span data-i18n="labels.between">${getTranslation('labels.between')}</span>
            <select class="range-min" data-type="harvest-min">
              ${generateRangeOptions(harvestRange[0])}
            </select>
            <span data-i18n="labels.and">${getTranslation('labels.and')}</span>
            <select class="range-max" data-type="harvest-max">
              ${generateRangeOptions(harvestRange[1])}
            </select>
            <span data-i18n="units.weeks">${getTranslation('units.weeks')}</span>
          </div>
        </div>

        <input type="text" id="scientific-name" value="${seed && seed.NomScientifique ? escapeHTML(seed.NomScientifique) : ''}" placeholder="${getTranslation('placeholders.scientific_name')}">

        <textarea id="remarks" rows="4" placeholder="${getTranslation('placeholders.remarks')}">${seed && seed.Remarques ? escapeHTML(seed.Remarques) : ''}</textarea>

        <input type="file" id="image" accept="image/*" style="display: none;">

        <input type="hidden" id="image-path" value="${seed ? escapeHTML(seed.Image) : ''}">

        <button type="submit" data-i18n="buttons.save">${getTranslation('buttons.save')}</button>
        ${isEdit ? `<button type="button" class="delete-btn" data-id="${escapeHTML(seed.id)}" data-i18n="buttons.delete">${getTranslation('buttons.delete')}</button>` : ''}
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  modal.style.display = 'flex';

  // Gestionnaire pour le clic sur l'image
  const imageInput = modal.querySelector('#image');
  const modalImage = modal.querySelector('#modal-image');
  modalImage.addEventListener('click', () => imageInput.click());

  imageInput.addEventListener('change', () => {
    if (imageInput.files[0]) {
      hasCustomImage = true;
      const reader = new FileReader();
      reader.onload = e => modalImage.src = e.target.result;
      reader.readAsDataURL(imageInput.files[0]);
    }
  });

  // Fonction pour mettre à jour les traductions de la modale
  const updateModalTranslations = () => {
    modal.querySelector('#common-name').placeholder = getTranslation('placeholders.common_name');
    modal.querySelector('#category option[value=""]').textContent = getTranslation('placeholders.select_category');
    modal.querySelector('#species option[value=""]').textContent = getTranslation('placeholders.select_species');
    modal.querySelector('#seed-type option[value=""]').textContent = getTranslation('placeholders.select_type');
    modal.querySelector('#seed-type option[value="Cyclique"]').textContent = getTranslation('fields.cyclique');
    modal.querySelector('#seed-type option[value="Statique"]').textContent = getTranslation('fields.statique');
    modal.querySelector('#remarks').placeholder = getTranslation('placeholders.remarks');
    modal.querySelector('#scientific-name').placeholder = getTranslation('placeholders.scientific_name');
    modal.querySelector('button[type="submit"]').innerHTML = getTranslation('buttons.save');
    if (isEdit) {
      modal.querySelector('.delete-btn').innerHTML = getTranslation('buttons.delete');
    }
    modal.querySelectorAll('.range-summary[data-type="harvest"]').forEach(el => {
      el.textContent = el.textContent.includes(getTranslation('units.weeks')) ? 
        el.textContent.replace(getTranslation('units.weeks'), getTranslation('units.weeks')) : 
        getTranslation('placeholders.select_seed_harvest_time');
    });
    modal.querySelectorAll('.range-summary[data-type="germination"]').forEach(el => {
      el.textContent = el.textContent.includes(getTranslation('units.days')) ? 
        el.textContent.replace(getTranslation('units.days'), getTranslation('units.days')) : 
        getTranslation('placeholders.select_seed_germination_time');
    });
modal.querySelectorAll('.month-summary').forEach(el => {
  const type = el.getAttribute('data-type');
  const selectedMonths = Array.from(modal.querySelectorAll(`.month-buttons[data-type="${type}"] .month-button.selected`))
    .map(btn => btn.getAttribute('data-month'));
  
  // Utiliser le bon placeholder selon le type
  const placeholderKey = type === 'sowing' 
    ? 'placeholders.select_seed_sowing_months' 
    : 'placeholders.select_seed_harvest_months';
  
  el.textContent = selectedMonths.length 
    ? selectedMonths.map(m => getTranslation(`months.${m}`)).join(', ') 
    : getTranslation(placeholderKey);
});
    modal.querySelectorAll('.month-buttons .month-button').forEach(btn => {
      const month = btn.getAttribute('data-month');
      btn.textContent = getTranslation(`months.${month}`);
    });
    modal.querySelectorAll('.range-selectors span[data-i18n="labels.between"]').forEach(span => {
      span.textContent = getTranslation('labels.between');
    });
    modal.querySelectorAll('.range-selectors span[data-i18n="labels.and"]').forEach(span => {
      span.textContent = getTranslation('labels.and');
    });
    modal.querySelectorAll('.range-selectors span[data-i18n="units.days"]').forEach(span => {
      span.textContent = getTranslation('units.days');
    });
    modal.querySelectorAll('.range-selectors span[data-i18n="units.weeks"]').forEach(span => {
      span.textContent = getTranslation('units.weeks');
    });
    modalImage.setAttribute('title', getTranslation('tooltips.change_image'));
    modalImage.setAttribute('alt', getTranslation('fields.seed_image'));
  };

  // Mettre à jour les traductions initiales
  updateModalTranslations();

  // Réagir aux changements de langue
  const languageChangeHandler = () => updateModalTranslations();
  document.addEventListener('languageChanged', languageChangeHandler);

  // Nettoyer le gestionnaire lorsque la modale est fermée
  const cleanup = () => {
    document.removeEventListener('languageChanged', languageChangeHandler);
    modal.remove();
  };

  modal.querySelector('.close').addEventListener('click', cleanup);

  // Gestionnaire pour mettre à jour les espèces selon la catégorie
  const categorySelect = modal.querySelector('#category');
  const speciesSelect = modal.querySelector('#species');
  function updateSpeciesOptions(selectedCategory) {
    speciesSelect.innerHTML = `<option value="" data-i18n="placeholders.select_species">${getTranslation('placeholders.select_species')}</option>`;
    const category = categories.find(cat => cat.name === selectedCategory);
    if (category && Array.isArray(category.species)) {
      category.species.forEach(species => {
        const option = document.createElement('option');
        option.value = species;
        option.textContent = species;
        if (seed && seed.Espèce === species) option.selected = true;
        speciesSelect.appendChild(option);
      });
    }
  }

  categorySelect.addEventListener('change', () => {
    updateSpeciesOptions(categorySelect.value);
  });

  if (seed && seed.Categorie) {
    updateSpeciesOptions(seed.Categorie);
  }

  // Gestionnaire pour les boutons de mois
  modal.querySelectorAll('.month-summary').forEach(summary => {
    const type = summary.getAttribute('data-type');
    const buttonsContainer = modal.querySelector(`.month-buttons[data-type="${type}"]`);

    summary.addEventListener('click', () => {
      const isVisible = buttonsContainer.style.display === 'block';
      modal.querySelectorAll('.month-buttons, .range-selectors').forEach(container => {
        container.style.display = 'none';
      });
      buttonsContainer.style.display = isVisible ? 'none' : 'block';
    });

    buttonsContainer.querySelectorAll('.month-button').forEach(button => {
      button.addEventListener('click', () => {
        button.classList.toggle('selected');
        const selectedMonths = Array.from(buttonsContainer.querySelectorAll('.month-button.selected'))
          .map(btn => btn.getAttribute('data-month'));
        summary.textContent = selectedMonths.length
          ? selectedMonths.map(m => getTranslation(`months.${m}`)).join(', ')
          : getTranslation('placeholders.select_seed_sowing_months');
      });
    });
  });

  // Gestionnaire pour les sélecteurs de plage
  modal.querySelectorAll('.range-summary').forEach(summary => {
    const type = summary.getAttribute('data-type');
    const selectorsContainer = modal.querySelector(`.range-selectors[data-type="${type}"]`);
    const minSelect = selectorsContainer.querySelector('.range-min');
    const maxSelect = selectorsContainer.querySelector('.range-max');

    summary.addEventListener('click', () => {
      const isVisible = selectorsContainer.style.display === 'block';
      modal.querySelectorAll('.month-buttons, .range-selectors').forEach(container => {
        container.style.display = 'none';
      });
      selectorsContainer.style.display = isVisible ? 'none' : 'block';
    });

    function updateSummary() {
      const min = minSelect.value;
      const max = maxSelect.value;
      summary.textContent = `${min}-${max} ${getTranslation(`units.${type === 'germination' ? 'days' : 'weeks'}`)}`;
    }

    minSelect.addEventListener('change', updateSummary);
    maxSelect.addEventListener('change', updateSummary);
  });

/*************  ✨ Windsurf Command ⭐  *************/
  /**
   * Handle the submission of the seed form
   * @param {Object} seed - The seed object
   * @param {boolean} isEdit - Whether the form is in edit mode or not
   * @param {Function} enhancedCloseModal - The enhanced close modal function
   */
/*******  dbc7243f-52f1-43d0-8d56-156ef773a425  *******/  // Gestionnaire de soumission
  modal.querySelector('#seed-form').addEventListener('submit', async e => {
    e.preventDefault();
    const commonName = modal.querySelector('#common-name').value.trim();
    const category = modal.querySelector('#category').value;
    const species = modal.querySelector('#species').value;
    const scientificName = modal.querySelector('#scientific-name').value.trim();
    const sowingMonths = Array.from(modal.querySelectorAll('.month-buttons[data-type="sowing"] .month-button.selected'))
      .map(btn => btn.getAttribute('data-month')).join(', ').trim();
    const harvestMonths = Array.from(modal.querySelectorAll('.month-buttons[data-type="harvest"] .month-button.selected'))
      .map(btn => btn.getAttribute('data-month')).join(', ').trim();
    const germinationMin = modal.querySelector('.range-min[data-type="germination-min"]').value;
    const germinationMax = modal.querySelector('.range-max[data-type="germination-max"]').value;
    const harvestMin = modal.querySelector('.range-min[data-type="harvest-min"]').value;
    const harvestMax = modal.querySelector('.range-max[data-type="harvest-max"]').value;
    const seedType = modal.querySelector('#seed-type').value;
    const remarks = modal.querySelector('#remarks').value.trim();
    const imageFile = modal.querySelector('#image').files[0];
    let imagePath = modal.querySelector('#image-path').value;

    // Validation des champs obligatoires
    if (!commonName || !category || !species || !seedType) {
      alert(getTranslation('errors.required'));
      return;
    }

    // Validation des plages
    if (Number(germinationMin) > Number(germinationMax) || Number(harvestMin) > Number(harvestMax)) {
      alert(getTranslation('errors.invalid_range'));
      return;
    }

    try {
      if (imageFile) {
        console.log('Uploading image:', imageFile.name);
        const formData = new FormData();
        formData.append('image', imageFile);
        const response = await fetch('/api/upload-image', { method: 'POST', body: formData });
        if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
        const result = await response.json();
        imagePath = result.image;
        hasCustomImage = true;
      } else if (isEdit && (!imagePath || isDefaultSeedImage(imagePath))) {
        imagePath = getDefaultSeedImage();
        hasCustomImage = false;
      } else if (!isEdit) {
        imagePath = getDefaultSeedImage();
        hasCustomImage = false;
      }

      const seeds = await loadSeeds();
      const newSeed = {
        id: isEdit ? seed.id : `seed_${Date.now()}`,
        NomCommun: commonName,
        Categorie: category,
        Espèce: species,
        NomScientifique: scientificName || undefined,
        DatesSemis: sowingMonths || undefined,
        DatesRécolte: harvestMonths || undefined,
        TempsGermination: germinationMin && germinationMax ? `${germinationMin}-${germinationMax}` : undefined,
        TempsPourRécolte: harvestMin && harvestMax ? `${harvestMin}-${harvestMax}` : undefined,
        Type: seedType,
        Remarques: remarks || undefined,
        Image: imagePath
      };

      if (isEdit) {
        const index = seeds.findIndex(s => s.id === seed.id);
        if (index !== -1) seeds[index] = newSeed;
      } else {
        seeds.push(newSeed);
      }

      await saveSeeds(seeds);
      console.log('Graines sauvegardées avec succès');
      cleanup();
      document.dispatchEvent(new Event('seedsUpdated'));
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
      alert(getTranslation('errors.save_failed'));
    }
  });

  // Gestionnaire de suppression
  if (isEdit) {
    modal.querySelector('.delete-btn').addEventListener('click', async () => {
      if (confirm(getTranslation('warnings.delete_seed'))) {
        try {
          await deleteSeed(seed.id);
          cleanup();
          document.dispatchEvent(new Event('seedsUpdated'));
        } catch (error) {
          console.error('Erreur lors de la suppression:', error);
          alert(getTranslation('errors.delete_failed'));
        }
      }
    });
  }
}

// Initialisation de l'onglet Graines
function initSeeds() {
  let container = document.getElementById('card-grid');
  if (container) {
    const newContainer = container.cloneNode(false);
    container.replaceWith(newContainer);
    container = newContainer;

    container.addEventListener('click', async e => {
      if (!document.querySelector('.active[data-tab="seeds"]')) return;
      e.stopPropagation();
      const card = e.target.closest('.vcard');
      if (!card) return;

      if (card.classList.contains('add-card')) {
        showSeedModal();
      } else {
        const seedId = card.dataset.id;
        const seeds = await loadSeeds();
        const seed = seeds.find(s => s.id === seedId);
        if (seed) showSeedModal(seed);
      }
    });
  }

  let updateCount = 0;
  document.addEventListener('seedsUpdated', async () => {
    updateCount++;
    console.log(`seedsUpdated déclenché ${updateCount} fois`);
    const seeds = await loadSeeds();
    if (document.querySelector('.active[data-tab="seeds"]')) {
      renderSeeds(seeds);
    }
  });

  document.addEventListener('languageChanged', async () => {
    const seeds = await loadSeeds();
    if (document.querySelector('.active[data-tab="seeds"]')) {
      renderSeeds(seeds);
    }
  });

  console.log('Initialisation des graines');
  document.dispatchEvent(new Event('seedsUpdated'));
}

window.initSeeds = initSeeds;
document.addEventListener('DOMContentLoaded', initSeeds);
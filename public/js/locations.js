// locations.js
// Variables globales pour le filtrage
let currentSearch = '';
let currentType = '';
let currentAddress = '';

// Fonction pour générer un ID unique
function generateUniqueId() {
  return `location_${Date.now()}`;
}

// Fonction pour obtenir l'image par défaut selon le type de lieu
function getDefaultLocationImage(type) {
  const images = {
    Parcelle: '/data/icons/parcelle.png',
    Pot: '/data/icons/pot.png',
    Caissette: '/data/icons/caissette.png'
  };
  return images[type] || '/data/icons/parcelle.png';
}

// Fonction pour vérifier si une image est l'image par défaut
function isDefaultLocationImage(imagePath, type) {
  return imagePath === getDefaultLocationImage(type);
}

// Fonction pour vérifier si une valeur est un nombre valide
function isValidNumber(value) {
  return !isNaN(parseFloat(value)) && isFinite(value) && parseFloat(value) >= 0;
}

// Fonction pour charger les lieux depuis l'API
async function loadLocations() {
  try {
    const locations = await fetchAPI('/api/locations');
    console.log('Lieux chargés:', locations.length);
    return locations.map(loc => ({
      ...loc,
      Image: loc.Image || getDefaultLocationImage(loc.Type)
    }));
  } catch (error) {
    console.error('Erreur lors du chargement des lieux:', error);
    return [];
  }
}

// Fonction pour sauvegarder les lieux via l'API
async function saveLocations(locations) {
  try {
    await fetchAPI('/api/locations', {
      method: 'PUT',
      body: JSON.stringify(locations)
    });
    console.log('Lieux sauvegardés:', locations.length);
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des lieux:', error);
    throw error;
  }
}

// Fonction pour supprimer un lieu via l'API
async function deleteLocation(id, force = false) {
  if (!id) {
    throw new Error(getTranslation('errors.invalid_id'));
  }
  try {
    const response = await fetchAPI('/api/locations/delete', {
      method: 'POST',
      body: JSON.stringify({ id, force })
    });
    console.log(`Lieu ${id} supprimé`);
    return response;
  } catch (error) {
    console.error('Erreur lors de la suppression du lieu:', error);
    const errorMessage = error.message.includes('Lieu utilisé dans une culture')
      ? getTranslation('errors.location_in_use')
      : error.message.includes('Entrée non trouvée')
      ? getTranslation('errors.not_found')
      : getTranslation('errors.delete_failed');
    throw new Error(errorMessage);
  }
}

// Fonction pour filtrer les lieux
function filterLocations(locations, search = '', type = '', address = '') {
  return locations.filter(loc => {
    const matchesSearch = !search || 
      (loc.Nom && loc.Nom.toLowerCase().includes(search.toLowerCase())) || 
      (loc.Adresse && loc.Adresse.toLowerCase().includes(search.toLowerCase()));
    const matchesType = !type || loc.Type === type;
    const matchesAddress = !address || (loc.Adresse && loc.Adresse === address);
    return matchesSearch && matchesType && matchesAddress;
  });
}

// Fonction pour mettre à jour le sélecteur d'adresses
function updateAddressFilter(locations) {
  const addressFilter = document.getElementById('address-filter');
  if (!addressFilter) return;
  
  const addresses = [...new Set(
    locations
      .filter(loc => loc.Adresse && loc.Adresse.trim())
      .map(loc => loc.Adresse)
  )].sort();
  
  const currentValue = addressFilter.value;
  addressFilter.innerHTML = `<option value="" data-i18n="placeholders.select_address">${getTranslation('placeholders.select_address')}</option>`;
  
  addresses.forEach(addr => {
    const option = document.createElement('option');
    option.value = addr;
    option.textContent = addr;
    if (addr === currentValue) option.selected = true;
    addressFilter.appendChild(option);
  });
}

// Fonction pour afficher les vCards des lieux
async function renderLocations(locations) {
  const grid = document.getElementById('card-grid');
  const toolsContainer = document.getElementById('tools-container');
  if (!grid || !toolsContainer) {
    console.error('Conteneurs #card-grid ou #tools-container manquants');
    return;
  }

  // Obtenir les types uniques
  const usedTypes = [...new Set(locations.map(l => l.Type).filter(t => t))];

  // Générer les outils de filtrage
  toolsContainer.innerHTML = `
    <span id="location-tools">
      <input type="text" id="search-filter" value="${escapeHTML(currentSearch)}" placeholder="${getTranslation('placeholders.search')}" title="${getTranslation('tooltips.search')}" aria-label="${getTranslation('tooltips.search')}">
      <select id="type-filter" class="filter-select" title="${getTranslation('tooltips.filter_type')}" aria-label="${getTranslation('tooltips.filter_type')}">
        <option value="" data-i18n="placeholders.select_type">${getTranslation('placeholders.select_type')}</option>
        ${usedTypes.map(type => `
          <option value="${escapeHTML(type)}" ${currentType === type ? 'selected' : ''}>
            ${getTranslation(`fields.${type.toLowerCase()}`)}
          </option>
        `).join('')}
      </select>
      <select id="address-filter" class="filter-select" title="${getTranslation('tooltips.filter_address')}" aria-label="${getTranslation('tooltips.filter_address')}">
        <option value="" data-i18n="placeholders.select_address">${getTranslation('placeholders.select_address')}</option>
      </select>
      <button class="filter-btn reset-filter" title="${getTranslation('tooltips.reset_filters')}" aria-label="${getTranslation('tooltips.reset_filters')}">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          <path d="M12 10l2 2-2 2"></path>
        </svg>
      </button>
    </span>
  `;
  
  // Mettre à jour le sélecteur d'adresses
  updateAddressFilter(locations);

  // Filtrer les lieux
  const filteredLocations = filterLocations(locations, currentSearch, currentType, currentAddress);

  // Nettoyer le contenu existant
  grid.innerHTML = '';

  // Créer la carte "Ajouter un lieu"
  const addCard = document.createElement('div');
  addCard.className = 'vcard location-card add-card';
  addCard.innerHTML = `<span data-i18n="buttons.add_location">${getTranslation('buttons.add_location')}</span>`;
  grid.appendChild(addCard);

  // Rendre les cartes des lieux
  filteredLocations.forEach(loc => {
    const card = document.createElement('div');
    card.className = 'vcard location-card';
    card.dataset.id = escapeHTML(loc.id);
    card.innerHTML = `
      <img src="${escapeHTML(loc.Image)}" alt="${escapeHTML(loc.Nom)}" style="max-width: 100%; height: 100px; object-fit: cover;">
      <h3>${escapeHTML(loc.Nom)}</h3>
      <p>${loc.Adresse ? escapeHTML(loc.Adresse) : '-'}</p>
      <p>${loc.Type ? getTranslation(`fields.${loc.Type.toLowerCase()}`) : '-'}
      ${loc.Type === 'Parcelle' && loc.Surface != null ? `${escapeHTML(loc.Surface.toString())} m²</p>` : ''}
      <p>${loc.Remarques ? escapeHTML(loc.Remarques) : ''}</p>
    `;
    grid.appendChild(card);
  });

  // Ajouter les gestionnaires d'événements pour les filtres
  const toolsSection = document.getElementById('location-tools');
  toolsSection.querySelector('#search-filter').addEventListener('input', e => {
    currentSearch = e.target.value.trim();
    document.dispatchEvent(new CustomEvent('locationsFiltered', { detail: { search: currentSearch, type: currentType, address: currentAddress } }));
  });

  toolsSection.querySelector('#type-filter').addEventListener('change', e => {
    currentType = e.target.value;
    document.dispatchEvent(new CustomEvent('locationsFiltered', { detail: { search: currentSearch, type: currentType, address: currentAddress } }));
  });

  toolsSection.querySelector('#address-filter').addEventListener('change', e => {
    currentAddress = e.target.value;
    document.dispatchEvent(new CustomEvent('locationsFiltered', { detail: { search: currentSearch, type: currentType, address: currentAddress } }));
  });

  toolsSection.querySelector('.reset-filter').addEventListener('click', () => {
    currentSearch = '';
    currentType = '';
    currentAddress = '';
    toolsSection.querySelector('#search-filter').value = '';
    toolsSection.querySelector('#type-filter').value = '';
    toolsSection.querySelector('#address-filter').value = '';
    document.dispatchEvent(new CustomEvent('locationsFiltered', { detail: { search: '', type: '', address: '' } }));
  });
}

// Fonction pour afficher la modale d'ajout/modification d'un lieu
async function showLocationModal(location = null) {
  if (document.querySelector('.modal')) {
    console.warn('Modale déjà ouverte');
    return;
  }

  const isEdit = !!location;
  const initialType = location ? location.Type : 'Parcelle';
  const initialImage = location ? location.Image : getDefaultLocationImage(initialType);
  let hasCustomImage = isEdit && location && !isDefaultLocationImage(location.Image, initialType);

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close">×</span>
      <img id="modal-image" src="${escapeHTML(initialImage)}" alt="${getTranslation('fields.location_image')}" style="display: block; margin: 0 auto 20px; max-width: 100%; height: 150px; object-fit: cover; cursor: pointer;" title="${getTranslation('tooltips.change_image')}">
      <form id="location-form">
        <input type="text" id="name" value="${isEdit ? escapeHTML(location.Nom || '') : ''}" placeholder="${getTranslation('placeholders.name')}" required>
        <input type="text" id="address" value="${isEdit ? escapeHTML(location.Adresse || '') : ''}" placeholder="${getTranslation('placeholders.address')}">
        <select id="type" required>
          <option value="" data-i18n="placeholders.select_type">${getTranslation('placeholders.select_type')}</option>
          <option value="Parcelle" ${isEdit && location.Type === 'Parcelle' ? 'selected' : ''} data-i18n="fields.parcelle">${getTranslation('fields.parcelle')}</option>
          <option value="Pot" ${isEdit && location.Type === 'Pot' ? 'selected' : ''} data-i18n="fields.pot">${getTranslation('fields.pot')}</option>
          <option value="Caissette" ${isEdit && location.Type === 'Caissette' ? 'selected' : ''} data-i18n="fields.caissette">${getTranslation('fields.caissette')}</option>
        </select>
        <div id="surface-container" style="display: ${initialType === 'Parcelle' ? 'block' : 'none'};">
          <label for="surface">${getTranslation('fields.surface')}</label>
          <input type="number" id="surface" step="0.1" min="0" value="${isEdit && location.Surface != null ? escapeHTML(location.Surface.toString()) : ''}" placeholder="${getTranslation('placeholders.surface')}" ${initialType === 'Parcelle' ? 'required' : ''}>
        </div>
        <textarea id="remarks" rows="4" placeholder="${getTranslation('placeholders.remarks')}">${isEdit && location.Remarques ? escapeHTML(location.Remarques) : ''}</textarea>
        <input type="file" id="image" accept="image/*" style="display: none;">
        <input type="hidden" id="image-path" value="${isEdit ? escapeHTML(location.Image || '') : ''}">
        <button type="submit" data-i18n="buttons.save">${getTranslation('buttons.save')}</button>
        ${isEdit ? `<button type="button" class="delete-btn" data-id="${escapeHTML(location.id)}" data-i18n="buttons.delete">${getTranslation('buttons.delete')}</button>` : ''}
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  modal.style.display = 'flex';

  const closeBtn = modal.querySelector('.close');
  const typeSelect = modal.querySelector('#type');
  const surfaceContainer = modal.querySelector('#surface-container');
  const surfaceInput = modal.querySelector('#surface');
  const modalImage = modal.querySelector('#modal-image');
  const imageInput = modal.querySelector('#image');

  closeBtn.addEventListener('click', () => modal.remove());

  typeSelect.addEventListener('change', () => {
    surfaceContainer.style.display = typeSelect.value === 'Parcelle' ? 'block' : 'none';
    surfaceInput.required = typeSelect.value === 'Parcelle';
    if (!hasCustomImage) {
      modalImage.src = getDefaultLocationImage(typeSelect.value);
    }
  });

  modalImage.addEventListener('click', () => imageInput.click());

  imageInput.addEventListener('change', () => {
    if (imageInput.files[0]) {
      hasCustomImage = true;
      const reader = new FileReader();
      reader.onload = e => modalImage.src = e.target.result;
      reader.readAsDataURL(imageInput.files[0]);
    }
  });

  modal.querySelector('#location-form').addEventListener('submit', async e => {
    e.preventDefault();
    const inputs = {
      name: modal.querySelector('#name').value.trim(),
      address: modal.querySelector('#address').value.trim(),
      type: modal.querySelector('#type').value,
      surface: modal.querySelector('#surface').value.trim(),
      remarks: modal.querySelector('#remarks').value.trim(),
      imageFile: modal.querySelector('#image').files[0],
      imagePath: modal.querySelector('#image-path').value
    };

    if (!inputs.name || !inputs.type) {
      alert(getTranslation('errors.required'));
      return;
    }

    if (inputs.type === 'Parcelle' && (!inputs.surface || !isValidNumber(inputs.surface))) {
      alert(getTranslation('errors.invalid_number'));
      return;
    }

    try {
      let imagePath = inputs.imagePath || getDefaultLocationImage(inputs.type);
      if (inputs.imageFile) {
        const formData = new FormData();
        formData.append('image', inputs.imageFile);
        const response = await fetch('/api/upload-image', { method: 'POST', body: formData });
        if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
        const result = await response.json();
        imagePath = result.image;
        hasCustomImage = true;
      } else if (!isEdit || (isEdit && isDefaultLocationImage(inputs.imagePath, initialType))) {
        imagePath = getDefaultLocationImage(inputs.type);
        hasCustomImage = false;
      }

      const locations = await loadLocations();
      const newLocation = {
        id: isEdit ? location.id : generateUniqueId(),
        Nom: inputs.name,
        Adresse: inputs.address || undefined,
        Type: inputs.type,
        Surface: inputs.type === 'Parcelle' && inputs.surface ? parseFloat(inputs.surface) : undefined,
        Remarques: inputs.remarks || undefined,
        Image: imagePath
      };

      if (isEdit) {
        const index = locations.findIndex(loc => loc.id === location.id);
        if (index === -1) throw new Error(`Lieu ${location.id} non trouvé`);
        locations[index] = newLocation;
      } else {
        locations.push(newLocation);
      }

      await saveLocations(locations);
      modal.remove();
      document.dispatchEvent(new Event('locationsUpdated'));
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
      alert(getTranslation('errors.save_failed'));
    }
  });

  if (isEdit) {
    modal.querySelector('.delete-btn').addEventListener('click', async () => {
      if (confirm(getTranslation('warnings.delete_location'))) {
        try {
          await deleteLocation(location.id);
          modal.remove();
          document.dispatchEvent(new Event('locationsUpdated'));
        } catch (error) {
          if (error.message === getTranslation('errors.location_in_use')) {
            if (confirm(getTranslation('warnings.force_delete_location'))) {
              try {
                await deleteLocation(location.id, true);
                modal.remove();
                document.dispatchEvent(new Event('locationsUpdated'));
              } catch (forceError) {
                console.error('Erreur lors de la suppression forcée:', forceError);
                alert(getTranslation('errors.delete_failed'));
              }
            }
          } else {
            console.error('Erreur lors de la suppression:', error);
            alert(getTranslation('errors.delete_failed'));
          }
        }
      }
    });
  }
}

// Initialisation
function initLocations() {
  let container = document.getElementById('card-grid');
  if (container) {
    const newContainer = container.cloneNode(false);
    container.replaceWith(newContainer);
    container = newContainer;

    container.addEventListener('click', async e => {
      if (!document.querySelector('.active[data-tab="locations"]')) return;
      e.stopPropagation();
      const card = e.target.closest('.vcard');
      if (!card) return;

      if (card.classList.contains('add-card')) {
        showLocationModal();
      } else {
        const locationId = card.dataset.id;
        const locations = await loadLocations();
        const location = locations.find(l => l.id === locationId);
        if (location) showLocationModal(location);
      }
    });
  }

  let updateCount = 0;
  document.addEventListener('locationsUpdated', async () => {
    updateCount++;
    console.log(`locationsUpdated déclenché ${updateCount} fois`);
    const locations = await loadLocations();
    if (document.querySelector('.active[data-tab="locations"]')) {
      renderLocations(locations);
    }
  });

  document.addEventListener('locationsFiltered', e => {
    currentSearch = e.detail.search || '';
    currentType = e.detail.type || '';
    currentAddress = e.detail.address || '';
    document.dispatchEvent(new Event('locationsUpdated'));
  });

  document.addEventListener('languageChanged', async () => {
    const locations = await loadLocations();
    if (document.querySelector('.active[data-tab="locations"]')) {
      renderLocations(locations);
    }
  });

  console.log('Initialisation des lieux');
  document.dispatchEvent(new Event('locationsUpdated'));
}

window.initLocations = initLocations;
document.addEventListener('DOMContentLoaded', initLocations);
// Fonction pour charger les récoltes
async function loadHarvests() {
  try {
    const harvests = await fetchAPI('/api/harvests');
    console.log('Récoltes chargées pour rapport:', harvests);
    return harvests;
  } catch (error) {
    console.error('Erreur lors du chargement des récoltes:', error);
    return [];
  }
}

// Fonction pour charger les cultures
async function loadCultures() {
  try {
    const cultures = await fetchAPI('/api/cultures');
    console.log('Cultures chargées pour rapport:', cultures);
    return cultures;
  } catch (error) {
    console.error('Erreur lors du chargement des cultures:', error);
    return [];
  }
}

// Fonction pour charger les graines
async function loadSeeds() {
  try {
    const seeds = await fetchAPI('/api/seeds');
    console.log('Graines chargées pour rapport:', seeds);
    return seeds;
  } catch (error) {
    console.error('Erreur lors du chargement des graines:', error);
    return [];
  }
}

// Fonction pour charger les lieux
async function loadLocations() {
  try {
    const locations = await fetchAPI('/api/locations');
    console.log('Lieux chargés pour rapport:', locations);
    return locations;
  } catch (error) {
    console.error('Erreur lors du chargement des lieux:', error);
    return [];
  }
}

// Fonction pour charger le rapport depuis l’API
async function loadReport() {
  try {
    const response = await fetchAPI('/api/bilan');
    const content = response.content || '';
    console.log('Rapport chargé:', content);
    return content;
  } catch (error) {
    console.error('Erreur chargement rapport:', error);
    return '';
  }
}

// Fonction pour sauvegarder le rapport via l’API
async function saveReport(content) {
  try {
    await fetchAPI('/api/bilan', {
      method: 'PUT',
      body: JSON.stringify({ content })
    });
    console.log('Rapport sauvegardé avec succès');
  } catch (error) {
    console.error('Erreur sauvegarde rapport:', error);
    console.warn('Échec de la sauvegarde, le rapport sera affiché localement');
  }
}

// Fonction pour convertir le Markdown en HTML simple
function markdownToHtml(markdown) {
  if (!markdown) {
    return `<p>${getTranslation('report.no_data')}</p>`;
  }
  return markdown
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^- (.*)$/gm, '<li>$1</li>')
    .replace(/\n/gm, '<br>')
    .replace(/<li>(.*?)<\/li>/g, '<ul><li>$1</li></ul>');
}

// Fonction pour générer le rapport
async function generateReport() {
  console.log('Génération du rapport...');
  const year = new Date().getFullYear();
  const harvests = await loadHarvests();
  const cultures = await loadCultures();
  const seeds = await loadSeeds();
  const locations = await loadLocations();

  let markdown = `# ${getTranslation('report.title')} ${year}\n\n`;

  if (harvests.length === 0) {
    markdown += `${getTranslation('report.no_harvests')}\n\n`;
  }

  for (const harvest of harvests) {
    const culture = cultures.find(c => c.id === harvest.Culture);
    const seed = culture ? seeds.find(s => s.id === culture.Plante) : null;
    const location = culture ? locations.find(l => l.id === culture.Lieu) : null;

    // Utiliser directement harvest.Nom
    markdown += `## ${getTranslation('report.harvest')} ${escapeHTML(harvest.Nom || 'Récolte sans nom')}\n`;

    markdown += `### ${getTranslation('report.plant_data')}\n`;
    if (seed) {
      markdown += `- ${getTranslation('fields.common_name')}: ${escapeHTML(seed['Nom commun'] || 'N/A')}\n`;
      markdown += `- ${getTranslation('fields.category')}: ${escapeHTML(seed.Catégorie || 'N/A')}\n`;
      markdown += `- ${getTranslation('fields.sowing_months')}: ${escapeHTML(seed['Mois de semis'] || 'N/A')}\n`;
      markdown += `- ${getTranslation('fields.harvest_months')}: ${escapeHTML(seed['Mois de récolte'] || 'N/A')}\n`;
      markdown += `- ${getTranslation('fields.germination_time')}: ${escapeHTML(seed['Temps de germination'] || 'N/A')} ${getTranslation('units.days')}\n`;
      markdown += `- ${getTranslation('fields.harvest_time')}: ${escapeHTML(seed['Temps pour récolte'] || 'N/A')} ${getTranslation('units.weeks')}\n`;
    } else {
      markdown += `- ${getTranslation('report.no_seed_data')}\n`;
    }

    markdown += `### ${getTranslation('report.culture_data')}\n`;
    if (culture && location) {
      markdown += `- ${getTranslation('fields.name')}: ${escapeHTML(culture.Nom || 'N/A')}\n`;
      markdown += `- ${getTranslation('fields.location')}: ${escapeHTML(location.Nom || 'N/A')} (${escapeHTML(location.Adresse || 'N/A')})\n`;
      markdown += `- ${getTranslation('fields.planting_date')}: ${escapeHTML(culture['Date de mise en terre'] || 'N/A')}\n`;
      markdown += `- ${getTranslation('fields.estimated_quantity')}: ${escapeHTML(culture['Quantité totale estimée'] || '0')} ${getTranslation('units.kg')}\n`;
    } else {
      markdown += `- ${getTranslation('report.no_culture_data')}\n`;
    }

    markdown += `### ${getTranslation('report.harvest_data')}\n`;
    markdown += `- ${getTranslation('fields.harvest_date')}: ${escapeHTML(harvest['Date de récolte'] || 'N/A')}\n`;
    markdown += `- ${getTranslation('fields.quantity')}: ${escapeHTML(harvest.Quantité || '0')} ${getTranslation('units.kg')}\n`;
    markdown += `- ${getTranslation('fields.next_harvest')}: ${escapeHTML(harvest['Prochaine récolte'] || 'N/A')} ${getTranslation('units.weeks')}\n`;

    markdown += `### ${getTranslation('report.analysis')}\n`;
    const estimated = parseFloat(culture && culture['Quantité totale estimée'] ? culture['Quantité totale estimée'] : 0);
    const harvested = parseFloat(harvest['Quantité totale récoltée'] || harvest.Quantité || 0);
    const diff = harvested - estimated;
    markdown += `- ${getTranslation('report.quantity_difference')}: ${diff.toFixed(2)} ${getTranslation('units.kg')} (${diff >= 0 ? getTranslation('report.excess') : getTranslation('report.deficit')})\n`;

    const plantingDate = culture && culture['Date de mise en terre'] ? new Date(culture['Date de mise en terre']) : null;
    const expectedHarvestTime = seed && seed['Temps pour récolte'] ? parseInt(seed['Temps pour récolte']) : 0;
    let expectedHarvestDate = null;
    if (plantingDate && expectedHarvestTime) {
      expectedHarvestDate = new Date(plantingDate);
      expectedHarvestDate.setDate(expectedHarvestDate.getDate() + expectedHarvestTime * 7);
    }
    const actualHarvestDate = harvest['Date de récolte'] ? new Date(harvest['Date de récolte']) : null;
    let delay = 'N/A';
    if (expectedHarvestDate && actualHarvestDate) {
      delay = Math.round((actualHarvestDate - expectedHarvestDate) / (1000 * 60 * 60 * 24));
      markdown += `- ${getTranslation('report.delay_difference')}: ${delay} ${getTranslation('units.days')} (${delay >= 0 ? getTranslation('report.delay') : getTranslation('report.advance')})\n`;
    } else {
      markdown += `- ${getTranslation('report.delay_difference')}: ${getTranslation('report.na')}\n`;
    }
    markdown += `- ${getTranslation('fields.remarks')}: ${escapeHTML(harvest.Remarques || culture && culture.Remarques || 'Aucune')}\n\n`;
  }

  await saveReport(markdown);
  console.log('Rapport généré:', markdown);
  return markdown;
}

// Fonction pour afficher le rapport
async function renderReport() {
  console.log('Rendu du rapport...');
  const container = document.getElementById('card-grid');
  if (!container) {
    console.error('Conteneur #card-grid manquant');
    return;
  }

  try {
    const reportContent = await loadReport();
    container.innerHTML = `
      <div class="report-container">
        <button id="generate-report" data-i18n="buttons.generate_report">${getTranslation('buttons.generate_report')}</button>
        <div id="report-content">${markdownToHtml(reportContent)}</div>
      </div>
    `;
    applyTranslations(); // Rafraîchir les traductions pour le bouton
    console.log('Contenu du rapport affiché:', reportContent);

    // Gestionnaire pour générer un nouveau rapport
    const generateButton = document.getElementById('generate-report');
    if (generateButton) {
      generateButton.addEventListener('click', async () => {
        try {
          const markdown = await generateReport();
          document.getElementById('report-content').innerHTML = markdownToHtml(markdown);
          applyTranslations();
          console.log('Nouveau rapport généré et affiché');
        } catch (error) {
          console.error('Erreur lors de la génération du rapport:', error);
          document.getElementById('report-content').innerHTML = `<p>${getTranslation('errors.generate_report_failed')}</p>`;
        }
      });
    } else {
      console.error('Bouton #generate-report non trouvé');
    }
  } catch (error) {
    console.error('Erreur lors du rendu du rapport:', error);
    container.innerHTML = `<p>${getTranslation('errors.generate_report_failed')}</p>`;
  }
}

// Initialisation de l’onglet Bilan
function initReports() {
  console.log('Initialisation de l’onglet Bilan');
  document.addEventListener('reportsUpdated', async () => {
    if (document.querySelector('.active[data-tab="bilan"]')) {
      console.log('Mise à jour du rapport');
      await renderReport();
    }
  });

  document.addEventListener('languageChanged', async () => {
    if (document.querySelector('.active[data-tab="bilan"]')) {
      console.log('Rafraîchissement du rapport après changement de langue');
      await renderReport();
    }
  });

  // Charger le rapport au démarrage si l'onglet est actif
  if (document.querySelector('.active[data-tab="bilan"]')) {
    console.log('Chargement initial du rapport');
    document.dispatchEvent(new Event('reportsUpdated'));
  }
}

// Exporter initReports pour l'utiliser dans index.html
window.initReports = initReports;
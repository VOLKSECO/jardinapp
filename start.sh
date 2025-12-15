#!/bin/bash

# Script pour lancer l'application Plant Manager sur Linux
# Vérifie et installe Node.js, installe les dépendances, lance le serveur et ouvre le navigateur

# Fonction pour afficher les messages avec couleur
log() {
    echo -e "\033[1;34m[INFO]\033[0m $1"
}

error() {
    echo -e "\033[1;31m[ERREUR]\033[0m $1"
    exit 1
}

# 1. Vérifier si Node.js est installé
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    log "Node.js ou npm non installé. Installation automatique..."
    
    # Vérifier si apt est disponible (Ubuntu/Debian)
    if command -v apt >/dev/null 2>&1; then
        log "Mise à jour des paquets et installation de Node.js..."
        sudo apt update || error "Échec de la mise à jour des paquets. Vérifiez votre connexion."
        sudo apt install -y nodejs npm || error "Échec de l'installation de Node.js. Essayez manuellement : https://nodejs.org/"
    else
        # Télécharger et installer Node.js (version 22.17.0 pour compatibilité)
        log "Téléchargement de Node.js v22.17.0..."
        curl -o node-v22.17.0-linux-x64.tar.xz https://nodejs.org/dist/v22.17.0/node-v22.17.0-linux-x64.tar.xz || error "Échec du téléchargement de Node.js."
        tar -xf node-v22.17.0-linux-x64.tar.xz || error "Échec de l'extraction de Node.js."
        sudo mv node-v22.17.0-linux-x64 /usr/local/node || error "Échec du déplacement de Node.js."
        export PATH=/usr/local/node/bin:$PATH
        # Ajouter au PATH pour la session actuelle
        log "Node.js installé localement dans /usr/local/node"
    fi
fi

# Vérifier la version de Node.js
NODE_VERSION=$(node -v 2>/dev/null || echo "N/A")
log "Node.js version $NODE_VERSION détecté"
NPM_VERSION=$(npm -v 2>/dev/null || echo "N/A")
log "npm version $NPM_VERSION détecté"

# 2. Vérifier si le dossier node_modules existe, sinon installer les dépendances
log "Vérification des dépendances du projet..."
if [ ! -d "node_modules" ]; then
    log "Installation des dépendances..."
    npm install || error "Échec de l'installation des dépendances. Vérifiez package.json et votre connexion."
else
    log "Dépendances déjà installées"
fi

# 3. Lancer le serveur
log "Lancement du serveur..."
node server.js &
SERVER_PID=$!
sleep 2  # Attendre que le serveur démarre

# Vérifier si le serveur a démarré
if ! ps -p $SERVER_PID >/dev/null 2>&1; then
    error "Échec du démarrage du serveur. Vérifiez les logs dans la console."
fi

# 4. Ouvrir le navigateur
log "Ouverture de l'application dans le navigateur..."
xdg-open http://localhost:3000 || error "Impossible d'ouvrir le navigateur. Accédez à http://localhost:3000 manuellement."

# 5. Garder le script en attente pour ne pas tuer le processus serveur
log "Application en cours d'exécution. Appuyez sur Ctrl+C pour arrêter."
wait $SERVER_PID
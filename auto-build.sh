#!/bin/bash

LOG_FILE="build-errors.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

log_error() {
    echo "[$TIMESTAMP] $1" >> "$LOG_FILE"
    echo "$1"
}

echo "=== Auto Build EAS avec changement de compte ==="
echo ""

# Remove projectId from app.json
echo "Suppression de l'ID du projet..."
sed -i 's/"projectId": "[^"]*"/"projectId": ""/g' app.json

# Logout from EAS
echo "Deconnexion EAS..."
npx eas-cli logout 2>/dev/null || eas logout 2>/dev/null || echo "Deja deconnecte"

echo ""
echo "=== Choix du compte ==="
echo "1) Ferelking1"
echo "2) Ferelking2"
echo "3) Ferelking3"
echo "4) Ferelking4"
echo "5) Ferelking5"
echo "6) Ferelking6"
echo "7) Ferelking7"
echo "8) Ferelking8"
echo "9) Ferelking9"
echo "10) Ferelking10"
echo ""
read -p "Choisis un compte (1-10): " choice

# Validate choice
if ! [[ "$choice" =~ ^[1-9]$|^10$ ]]; then
    log_error "ERREUR: Choix invalide ($choice). Utilise un nombre entre 1 et 10."
    exit 1
fi

# Set username based on choice
USERNAME="Ferelking${choice}"

# Get password from env var or prompt
if [ -z "$EAS_PASSWORD" ]; then
    read -s -p "Mot de passe pour $USERNAME: " PASSWORD
    echo ""
else
    PASSWORD="$EAS_PASSWORD"
fi

echo ""
echo "=== Connexion au compte $USERNAME ==="

# Create expect script for login
cat > /tmp/eas_login.exp << EOF
#!/usr/bin/expect -f
set timeout 60
spawn npx eas-cli login
expect {
    "Email or username:" {
        send "$USERNAME\r"
        exp_continue
    }
    "Password:" {
        send "$PASSWORD\r"
        exp_continue
    }
    "Logged in" {
        exit 0
    }
    timeout {
        exit 1
    }
    eof {
        exit 0
    }
}
EOF

# Try expect if available
if command -v expect &> /dev/null; then
    chmod +x /tmp/eas_login.exp
    /tmp/eas_login.exp 2>&1
    LOGIN_RESULT=$?
else
    # Fallback: use here-doc approach
    echo "Expect non disponible, connexion manuelle requise..."
    log_error "ERREUR: expect non installe. Connexion manuelle requise."
    echo ""
    echo "Execute manuellement:"
    echo "  npx eas-cli login"
    echo "  Username: $USERNAME"
    echo ""
    
    # Try piping credentials
    {
        echo "$USERNAME"
        sleep 1
        echo "$PASSWORD"
    } | npx eas-cli login 2>&1
    LOGIN_RESULT=$?
fi

# Verify login
echo ""
echo "Verification de la connexion..."
CURRENT_USER=$(npx eas-cli whoami 2>&1)

if [[ "$CURRENT_USER" == *"Not logged in"* ]] || [ -z "$CURRENT_USER" ]; then
    log_error "ERREUR LOGIN: Impossible de se connecter a $USERNAME. Reponse: $CURRENT_USER"
    echo ""
    echo "Connexion manuelle requise. Execute:"
    echo "  npx eas-cli login"
    echo "  Username: $USERNAME"
    exit 1
fi

echo "Connecte en tant que: $CURRENT_USER"
echo ""
echo "=== Lancement du build Android ==="
echo ""

# Run eas build with auto-yes for prompts
MAX_RETRIES=3
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo "Tentative de build $((RETRY_COUNT + 1))/$MAX_RETRIES..."
    
    # Capture output for logging
    BUILD_OUTPUT=$(yes | npx eas-cli build --platform android --profile preview --non-interactive 2>&1)
    BUILD_RESULT=$?
    
    echo "$BUILD_OUTPUT"
    
    if [ $BUILD_RESULT -eq 0 ]; then
        echo ""
        echo "=== BUILD REUSSI! ==="
        exit 0
    else
        log_error "ERREUR BUILD (tentative $((RETRY_COUNT + 1))): Code $BUILD_RESULT"
        log_error "Output: $BUILD_OUTPUT"
        echo ""
        RETRY_COUNT=$((RETRY_COUNT + 1))
        
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            echo "Nouvelle tentative dans 10 secondes..."
            sleep 10
        fi
    fi
done

log_error "ECHEC FINAL: Build echoue apres $MAX_RETRIES tentatives pour $USERNAME"
echo ""
echo "=== ECHEC apres $MAX_RETRIES tentatives ==="
echo "Consulte $LOG_FILE pour plus de details."
exit 1

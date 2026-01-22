#!/bin/bash

echo "=== Changement de compte EAS ==="
echo ""

# Remove projectId from app.json
echo "Suppression de l'ID du projet..."
sed -i 's/"projectId": "[^"]*"/"projectId": ""/g' app.json

# Logout from EAS
echo "Deconnexion EAS..."
npx eas-cli logout 2>/dev/null || eas logout 2>/dev/null || echo "Deja deconnecte"

echo ""
echo "Pret! Maintenant execute:"
echo "  eas login"
echo "  npx eas build --profile preview --platform android"
echo ""

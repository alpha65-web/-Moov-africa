#!/bin/sh
# Vault initialization script for PIM encryption keys
# Run after Vault starts in dev mode: docker exec pim-vault sh /vault/init.sh

set -e

export VAULT_ADDR="http://127.0.0.1:8200"

# Wait for Vault to be ready
echo "Waiting for Vault to be ready..."
until vault status > /dev/null 2>&1; do
  sleep 1
done

# KV v2 is enabled by default at secret/ in dev mode
# Generate a cryptographically secure AES-256 key
AES_KEY=$(vault write -f -field=random_bytes sys/tools/random/32 format=base64 2>/dev/null || \
          cat /dev/urandom | head -c 32 | base64)

# Store the encryption key in Vault
vault kv put secret/pim \
  pim.encryption.key="$AES_KEY"

echo "Vault initialized successfully."
echo "Encryption key stored at: secret/pim"
echo ""
echo "To verify: vault kv get secret/pim"

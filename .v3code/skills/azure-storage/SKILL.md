---
name: azure-storage
description: Azure Blob Storage, File Shares, and data management
keywords:
  - blob
  - storage
  - upload
  - download
  - container
  - SAS token
  - lifecycle
  - archive
  - file share
alwaysApply: false
---

# Azure Storage Skill

## Storage Services

| Service | Use Case |
|---------|----------|
| Blob Storage | Unstructured data (images, documents, backups) |
| File Shares | SMB/NFS file shares (lift-and-shift) |
| Queue Storage | Async message queuing |
| Table Storage | NoSQL key-value (simple, cheap) |

## Blob Storage Operations

### SDK (Node.js)
```typescript
import { BlobServiceClient } from '@azure/storage-blob';

const client = BlobServiceClient.fromConnectionString(process.env.STORAGE_CONNECTION);
const container = client.getContainerClient('uploads');

// Upload
const blockBlob = container.getBlockBlobClient('images/photo.jpg');
await blockBlob.uploadFile('./local-photo.jpg');

// Download
const downloadResponse = await blockBlob.download();
const content = await streamToBuffer(downloadResponse.readableStreamBody);

// List blobs
for await (const blob of container.listBlobsFlat()) {
  console.log(blob.name, blob.properties.contentLength);
}

// Delete
await blockBlob.delete();
```

### CLI
```bash
# Upload file
az storage blob upload -c uploads -f ./file.txt -n documents/file.txt

# Download
az storage blob download -c uploads -n documents/file.txt -f ./local-file.txt

# List
az storage blob list -c uploads -o table

# Generate SAS URL (time-limited access)
az storage blob generate-sas -c uploads -n file.txt \
  --permissions r --expiry 2024-12-31 --full-uri
```

## Access Tiers

| Tier | Access | Cost (Storage) | Cost (Access) | Use |
|------|--------|----------------|---------------|-----|
| Hot | Frequent | $$$ | $ | Active data |
| Cool | Infrequent | $$ | $$ | 30+ day retention |
| Cold | Rare | $ | $$$ | 90+ day retention |
| Archive | Very rare | ¢ | $$$$ | Years of retention |

## Lifecycle Management

```json
{
  "rules": [
    {
      "name": "move-to-cool",
      "type": "Lifecycle",
      "definition": {
        "actions": {
          "baseBlob": {
            "tierToCool": { "daysAfterModificationGreaterThan": 30 },
            "tierToArchive": { "daysAfterModificationGreaterThan": 365 },
            "delete": { "daysAfterModificationGreaterThan": 730 }
          }
        },
        "filters": {
          "blobTypes": ["blockBlob"],
          "prefixMatch": ["logs/", "backups/"]
        }
      }
    }
  ]
}
```

## Security

- Use Managed Identity (not connection strings) in production
- Use SAS tokens for temporary external access (short expiry)
- Enable soft delete for accidental deletion protection
- Use immutable storage for compliance (WORM)
- Enable versioning for critical data
- Restrict network access (VNet, private endpoint, IP rules)

## Static Website Hosting

```bash
# Enable static website
az storage blob service-properties update \
  --account-name mystorage --static-website \
  --index-document index.html --404-document 404.html

# Upload site
az storage blob upload-batch -s ./dist -d '$web'
```
